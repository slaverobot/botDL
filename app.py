from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, session
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
import yt_dlp
import os
import re
import uuid
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

# ============ LOGGING CONFIG ============
# Punguza logging ili isionekane kwa mtumiaji
logging.basicConfig(level=logging.WARNING)
log = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')

# ============ HEALTH CHECK ============
@app.route('/health')
def health():
    """Health check endpoint for Render - returns 200 OK"""
    return '', 200

# ============ SESSION / COOKIE CONFIG ============
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = bool(os.environ.get('RENDER'))
app.config['SESSION_COOKIE_HTTPONLY'] = True

# ============ CORS ============
CORS(app, supports_credentials=True, origins=[
    'https://botdl-3qgc.onrender.com',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
])

# ============ DATABASE SETUP ============
DATABASE_URL = os.getenv('DATABASE_URL')

def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        log.error(f"Database error: {e}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn:
        return
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            picture TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS downloads (
            id SERIAL PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            video_url TEXT,
            video_title TEXT,
            video_thumbnail TEXT,
            video_quality TEXT,
            download_date TIMESTAMP DEFAULT NOW()
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS favorites (
            id SERIAL PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            video_url TEXT,
            video_title TEXT,
            video_thumbnail TEXT,
            added_date TIMESTAMP DEFAULT NOW()
        )
    ''')
    conn.commit()
    cur.close()
    conn.close()
    log.info("Database ready")

# ============ LOGIN MANAGER ============
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin):
    def __init__(self, id, email, name, picture):
        self.id = id
        self.email = email
        self.name = name
        self.picture = picture

@login_manager.user_loader
def load_user(user_id):
    conn = get_db_connection()
    if not conn:
        return None
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    if user:
        return User(user['id'], user['email'], user['name'], user['picture'])
    return None

# ============ OAUTH SETUP ============
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

# ============ DOWNLOAD DIR ============
DOWNLOAD_DIR = '/tmp/downloads' if os.environ.get('RENDER') else os.path.join(os.path.dirname(__file__), 'downloads')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# ============ HELPERS ============
def get_platform(url):
    u = url.lower()
    if 'youtube.com' in u or 'youtu.be' in u: return 'YouTube'
    if 'tiktok.com' in u: return 'TikTok'
    if 'instagram.com' in u: return 'Instagram'
    if 'facebook.com' in u or 'fb.watch' in u: return 'Facebook'
    if 'twitter.com' in u or 'x.com' in u: return 'Twitter'
    if 'vimeo.com' in u: return 'Vimeo'
    return 'Unknown'

def format_duration(sec):
    if not sec: return '00:00'
    m, s = divmod(int(sec), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

# ============ AUTH ROUTES ============
@app.route('/login')
def login():
    redirect_uri = url_for('google_auth', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/google-auth')
def google_auth():
    try:
        token = google.authorize_access_token()
        if not token:
            return redirect(url_for('index'))

        user_info = token.get('userinfo')
        if not user_info:
            resp = google.get('https://openidconnect.googleapis.com/v1/userinfo')
            user_info = resp.json()

        user_id = user_info.get('sub')
        if not user_id:
            return redirect(url_for('index'))

        user_email = user_info.get('email', '')
        user_name = user_info.get('name', user_email)
        user_picture = user_info.get('picture', '')

        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO users (id, email, name, picture)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET name = EXCLUDED.name,
                    picture = EXCLUDED.picture
            """, (user_id, user_email, user_name, user_picture))
            conn.commit()
            cur.close()
            conn.close()

        user = User(user_id, user_email, user_name, user_picture)
        login_user(user)
        session['user_id'] = user_id
        return redirect(url_for('index'))

    except Exception as e:
        return redirect(url_for('index'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    session.clear()
    return redirect(url_for('index'))

@app.route('/api/user')
@login_required
def get_user():
    return jsonify({
        'id': current_user.id,
        'email': current_user.email,
        'name': current_user.name,
        'picture': current_user.picture
    })

# ============ MAIN ============
@app.route('/')
def index():
    return render_template('index.html', user=current_user if current_user.is_authenticated else None)

# ============ ANALYZE ============
@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'headers': {'User-Agent': 'Mozilla/5.0'}
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        formats = []
        seen = set()
        qmap = {
            144: '144p', 240: '240p', 360: '360p', 480: '480p',
            720: '720p', 1080: '1080p', 1440: '2K', 2160: '4K'
        }

        for f in info.get('formats', []):
            h = f.get('height')
            if h and f.get('acodec') != 'none' and h <= 4320:
                label = qmap.get(min(qmap.keys(), key=lambda x: abs(x - h)), f'{h}p')
                if label not in seen:
                    seen.add(label)
                    formats.append({
                        'format_id': str(f['format_id']),
                        'label': label,
                        'ext': f.get('ext', 'mp4')
                    })

        formats.sort(key=lambda x: int(x['label'].replace('p', '')) if x['label'].replace('p', '').isdigit() else 999)
        formats.append({'format_id': 'bestaudio/best', 'label': 'MP3', 'ext': 'mp3'})

        if current_user.is_authenticated:
            try:
                conn = get_db_connection()
                if conn:
                    cur = conn.cursor()
                    cur.execute(
                        "INSERT INTO downloads (user_id, video_url, video_title, video_thumbnail) VALUES (%s, %s, %s, %s)",
                        (current_user.id, url, info.get('title'), info.get('thumbnail'))
                    )
                    conn.commit()
                    cur.close()
                    conn.close()
            except Exception as db_err:
                log.error(f"DB insert error: {db_err}")

        return jsonify({
            'url': url,
            'title': info.get('title'),
            'thumbnail': info.get('thumbnail'),
            'duration': format_duration(info.get('duration')),
            'platform': get_platform(url),
            'uploader': info.get('uploader'),
            'view_count': info.get('view_count'),
            'formats': formats
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ DOWNLOAD ============
@app.route('/download', methods=['POST'])
def download():
    data = request.get_json()
    url = data.get('url')
    format_id = data.get('format_id')
    title = data.get('title_hint', 'video')

    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    vid = str(uuid.uuid4())[:8]
    output = os.path.join(DOWNLOAD_DIR, f'{vid}.%(ext)s')
    is_audio = format_id == 'bestaudio/best'

    try:
        if is_audio:
            opts = {
                'format': 'bestaudio/best',
                'outtmpl': output,
                'quiet': True,
                'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3'}]
            }
        else:
            opts = {
                'format': 'best[ext=mp4]/best',
                'outtmpl': output,
                'quiet': True
            }

        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.extract_info(url, download=True)

        for f in os.listdir(DOWNLOAD_DIR):
            if f.startswith(vid):
                path = os.path.join(DOWNLOAD_DIR, f)
                ext = f.split('.')[-1]
                safe = re.sub(r'[^\w\s-]', '', title)[:40].replace(' ', '_')
                resp = send_file(path, as_attachment=True, download_name=f"{safe}.{ext}")
                resp.call_on_close(lambda: os.remove(path))
                return resp

        return jsonify({'error': 'Downloaded file not found'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ DASHBOARD ROUTES ============
@app.route('/dashboard')
@login_required
def dashboard():
    try:
        conn = get_db_connection()
        recent_downloads = []
        history_count = 0
        created_at = None
        
        if conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT * FROM downloads WHERE user_id = %s ORDER BY download_date DESC LIMIT 5", (current_user.id,))
            recent_downloads = cur.fetchall()
            cur.execute("SELECT COUNT(*) FROM downloads WHERE user_id = %s", (current_user.id,))
            history_count = cur.fetchone()['count']
            cur.execute("SELECT created_at FROM users WHERE id = %s", (current_user.id,))
            result = cur.fetchone()
            if result:
                created_at = result['created_at']
            cur.close()
            conn.close()
        
        return render_template('dashboard_home.html', 
                             user=current_user, 
                             recent_downloads=recent_downloads,
                             history_count=history_count,
                             member_since=created_at.strftime('%b %Y') if created_at else 'New')
    except Exception as e:
        log.error(f"Dashboard error: {e}")
        return render_template('dashboard_home.html', user=current_user, recent_downloads=[], history_count=0, member_since='New')

@app.route('/dashboard/history')
@login_required
def history_page():
    try:
        conn = get_db_connection()
        history = []
        if conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT * FROM downloads WHERE user_id = %s ORDER BY download_date DESC", (current_user.id,))
            history = cur.fetchall()
            cur.close()
            conn.close()
        return render_template('dashboard_history.html', user=current_user, history=history)
    except Exception as e:
        log.error(f"History error: {e}")
        return render_template('dashboard_history.html', user=current_user, history=[])

@app.route('/dashboard/favorites')
@login_required
def favorites_page():
    try:
        conn = get_db_connection()
        favorites = []
        if conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT * FROM favorites WHERE user_id = %s ORDER BY added_date DESC", (current_user.id,))
            favorites = cur.fetchall()
            cur.close()
            conn.close()
        return render_template('dashboard_favorites.html', user=current_user, favorites=favorites)
    except Exception as e:
        log.error(f"Favorites error: {e}")
        return render_template('dashboard_favorites.html', user=current_user, favorites=[])

@app.route('/dashboard/profile')
@login_required
def profile_page():
    try:
        conn = get_db_connection()
        history_count = 0
        favorites_count = 0
        created_at = None
        
        if conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM downloads WHERE user_id = %s", (current_user.id,))
            history_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM favorites WHERE user_id = %s", (current_user.id,))
            favorites_count = cur.fetchone()[0]
            cur.execute("SELECT created_at FROM users WHERE id = %s", (current_user.id,))
            result = cur.fetchone()
            if result:
                created_at = result[0]
            cur.close()
            conn.close()
        
        return render_template('dashboard_profile.html', 
                             user=current_user, 
                             history_count=history_count, 
                             favorites_count=favorites_count,
                             created_at=created_at)
    except Exception as e:
        log.error(f"Profile error: {e}")
        return render_template('dashboard_profile.html', user=current_user, history_count=0, favorites_count=0, created_at=None)

# ============ DELETE HISTORY ROUTES ============
@app.route('/api/history/<int:history_id>', methods=['DELETE'])
@login_required
def delete_history(history_id):
    try:
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute(
                "DELETE FROM downloads WHERE id = %s AND user_id = %s",
                (history_id, current_user.id)
            )
            affected = cur.rowcount
            conn.commit()
            cur.close()
            conn.close()
            if affected > 0:
                return jsonify({'success': True})
            return jsonify({'error': 'Entry not found'}), 404
        return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history/clear', methods=['DELETE'])
@login_required
def clear_all_history():
    try:
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM downloads WHERE user_id = %s", (current_user.id,))
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({'success': True})
        return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ INIT ============
with app.app_context():
    init_db()

# ============ RUN APP ============
if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
