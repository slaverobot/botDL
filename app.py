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

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
CORS(app)

# ============ SUPABASE DATABASE SETUP (PostgreSQL) ============
DATABASE_URL = os.getenv('DATABASE_URL')

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def init_db():
    """Create tables if they don't exist"""
    conn = get_db_connection()
    if conn:
        cur = conn.cursor()
        # Users table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                picture TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_premium BOOLEAN DEFAULT FALSE,
                is_admin BOOLEAN DEFAULT FALSE
            )
        ''')
        # Downloads history table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS downloads (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                video_url TEXT NOT NULL,
                video_title TEXT,
                video_thumbnail TEXT,
                video_quality TEXT,
                download_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        ''')
        # Favorites table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS favorites (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                video_url TEXT NOT NULL,
                video_title TEXT,
                video_thumbnail TEXT,
                added_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        ''')
        conn.commit()
        cur.close()
        conn.close()
        print("✅ Database tables ready!")
    else:
        print("❌ Database connection failed!")

# ============ LOGIN MANAGER ============
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin):
    def __init__(self, id, email, name, picture, is_premium=False, is_admin=False):
        self.id = id
        self.email = email
        self.name = name
        self.picture = picture
        self.is_premium = is_premium
        self.is_admin = is_admin

@login_manager.user_loader
def load_user(user_id):
    conn = get_db_connection()
    if conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        if user:
            return User(user['id'], user['email'], user['name'], user['picture'], 
                       user.get('is_premium', False), user.get('is_admin', False))
    return None

# ============ OAUTH SETUP ============
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    access_token_url='https://oauth2.googleapis.com/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    userinfo_endpoint='https://www.googleapis.com/oauth2/v1/userinfo',  # Angalia: quotes zimeondolewa na URL ni sahihi
    client_kwargs={'scope': 'openid email profile'},
    jwks_uri='https://www.googleapis.com/oauth2/v3/certs'
)

# ============ DOWNLOAD DIRECTORY ============
if os.environ.get('RENDER'):
    DOWNLOAD_DIR = '/tmp/downloads'
else:
    DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# ============ HELPER FUNCTIONS ============
def get_platform(url):
    url_lower = url.lower()
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "YouTube"
    elif "tiktok.com" in url_lower:
        return "TikTok"
    elif "instagram.com" in url_lower:
        return "Instagram"
    elif "facebook.com" in url_lower or "fb.watch" in url_lower:
        return "Facebook"
    return "Unknown"

def format_duration(seconds):
    if not seconds:
        return "00:00"
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"

# ============ AUTH ROUTES ============
@app.route('/login')
def login():
    redirect_uri = url_for('google_auth', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/google-auth')
def google_auth():
    try:
        token = google.authorize_access_token()
        userinfo = google.get('userinfo')
        user_info = userinfo.json()
        
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO users (id, email, name, picture) 
                VALUES (%s, %s, %s, %s) 
                ON CONFLICT (id) DO UPDATE SET 
                    name = EXCLUDED.name, 
                    picture = EXCLUDED.picture
            """, (user_info['id'], user_info['email'], user_info['name'], user_info.get('picture', '')))
            conn.commit()
            cur.close()
            conn.close()
        
        user = User(user_info['id'], user_info['email'], user_info['name'], user_info.get('picture', ''))
        login_user(user)
        session['user_id'] = user_info['id']
        return redirect(url_for('index'))
        
    except Exception as e:
        print(f"Auth error: {e}")
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
        'picture': current_user.picture,
        'is_premium': current_user.is_premium
    })

# ============ MAIN ROUTES ============
@app.route('/')
def index():
    return render_template('index.html', user=current_user if current_user.is_authenticated else None)

# ============ DASHBOARD ROUTES ============
@app.route('/dashboard')
@login_required
def dashboard():
    conn = get_db_connection()
    recent_downloads = []
    favorites = []
    history_count = 0
    favorites_count = 0
    
    if conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM downloads WHERE user_id = %s ORDER BY download_date DESC LIMIT 5", (current_user.id,))
        recent_downloads = cur.fetchall()
        cur.execute("SELECT * FROM favorites WHERE user_id = %s", (current_user.id,))
        favorites = cur.fetchall()
        cur.execute("SELECT COUNT(*) FROM downloads WHERE user_id = %s", (current_user.id,))
        history_count = cur.fetchone()['count']
        favorites_count = len(favorites)
        cur.close()
        conn.close()
    
    member_since = "New"
    conn = get_db_connection()
    if conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT created_at FROM users WHERE id = %s", (current_user.id,))
        user_data = cur.fetchone()
        if user_data and user_data['created_at']:
            member_since = user_data['created_at'].strftime('%b %Y')
        cur.close()
        conn.close()
    
    return render_template('dashboard/home.html', 
                         user=current_user, 
                         recent_downloads=recent_downloads,
                         history_count=history_count,
                         favorites_count=favorites_count,
                         member_since=member_since)

@app.route('/dashboard/history')
@login_required
def history_page():
    conn = get_db_connection()
    history = []
    if conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM downloads WHERE user_id = %s ORDER BY download_date DESC", (current_user.id,))
        history = cur.fetchall()
        cur.close()
        conn.close()
    return render_template('dashboard/history.html', user=current_user, history=history)

@app.route('/dashboard/favorites')
@login_required
def favorites_page():
    conn = get_db_connection()
    favorites = []
    if conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM favorites WHERE user_id = %s ORDER BY added_date DESC", (current_user.id,))
        favorites = cur.fetchall()
        cur.close()
        conn.close()
    return render_template('dashboard/favorites.html', user=current_user, favorites=favorites)

@app.route('/dashboard/profile')
@login_required
def profile_page():
    conn = get_db_connection()
    history_count = 0
    favorites_count = 0
    if conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM downloads WHERE user_id = %s", (current_user.id,))
        history_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM favorites WHERE user_id = %s", (current_user.id,))
        favorites_count = cur.fetchone()[0]
        cur.close()
        conn.close()
    return render_template('dashboard/profile.html', 
                         user=current_user, 
                         history_count=history_count, 
                         favorites_count=favorites_count)

# ============ API ROUTES ============
@app.route('/api/favorite/add', methods=['POST'])
@login_required
def add_favorite():
    data = request.get_json()
    conn = get_db_connection()
    if conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM favorites WHERE user_id = %s AND video_url = %s", (current_user.id, data.get('url')))
        existing = cur.fetchone()
        if not existing:
            cur.execute("""
                INSERT INTO favorites (user_id, video_url, video_title, video_thumbnail) 
                VALUES (%s, %s, %s, %s)
            """, (current_user.id, data.get('url'), data.get('title', 'Unknown'), data.get('thumbnail', '')))
            conn.commit()
        cur.close()
        conn.close()
    return jsonify({'success': True})

@app.route('/api/favorite/remove', methods=['POST'])
@login_required
def remove_favorite():
    data = request.get_json()
    conn = get_db_connection()
    if conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM favorites WHERE user_id = %s AND video_url = %s", (current_user.id, data.get('url')))
        conn.commit()
        cur.close()
        conn.close()
    return jsonify({'success': True})

# ============ VIDEO DOWNLOAD ROUTES ============
@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    url = data.get('url', '').strip()
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        
        formats = []
        seen = set()
        quality_map = {144: '144p', 240: '240p', 360: '360p', 480: '480p',
                       720: '720p', 1080: '1080p', 1440: '2K', 2160: '4K', 4320: '8K'}
        
        for f in info.get('formats', []):
            height = f.get('height')
            acodec = f.get('acodec', 'none')
            if height and acodec != 'none' and height <= 4320:
                label = quality_map.get(min(quality_map.keys(), key=lambda x: abs(x - height)), f'{height}p')
                if label not in seen:
                    seen.add(label)
                    formats.append({
                        'format_id': str(f.get('format_id')),
                        'label': label,
                        'ext': f.get('ext', 'mp4')
                    })
        
        formats.sort(key=lambda x: int(x['label'].replace('p', '')) if x['label'].replace('p', '').isdigit() else 999)
        formats.append({'format_id': 'bestaudio/best', 'label': 'MP3', 'ext': 'mp3'})
        
        # Save to history if user logged in
        if current_user.is_authenticated:
            conn = get_db_connection()
            if conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO downloads (user_id, video_url, video_title, video_thumbnail) 
                    VALUES (%s, %s, %s, %s)
                """, (current_user.id, url, info.get('title', 'Unknown'), info.get('thumbnail', '')))
                conn.commit()
                cur.close()
                conn.close()
        
        return jsonify({
            'title': info.get('title', 'Unknown'),
            'thumbnail': info.get('thumbnail', ''),
            'duration': format_duration(info.get('duration')),
            'platform': get_platform(url),
            'formats': formats,
            'url': url
        })
        
    except Exception as e:
        return jsonify({'error': str(e)[:150]}), 500

@app.route('/download', methods=['POST'])
def download():
    data = request.get_json()
    url = data.get('url', '').strip()
    format_id = data.get('format_id', '')
    title = data.get('title_hint', 'video')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    download_id = str(uuid.uuid4())[:8]
    is_audio = format_id == 'bestaudio/best'
    
    try:
        output_template = os.path.join(DOWNLOAD_DIR, f'{download_id}.%(ext)s')
        
        if is_audio:
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': output_template,
                'quiet': True,
                'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3'}]
            }
        else:
            ydl_opts = {
                'format': 'best',
                'outtmpl': output_template,
                'quiet': True,
            }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(url, download=True)
        
        for file in os.listdir(DOWNLOAD_DIR):
            if file.startswith(download_id):
                downloaded_file = os.path.join(DOWNLOAD_DIR, file)
                ext = downloaded_file.split('.')[-1]
                safe_title = re.sub(r'[^\w\s-]', '', title)[:40]
                response = send_file(downloaded_file, as_attachment=True, download_name=f"{safe_title}.{ext}")
                
                @response.call_on_close
                def cleanup():
                    try:
                        os.remove(downloaded_file)
                    except:
                        pass
                return response
        
        return jsonify({'error': 'Download failed'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)[:150]}), 500

# ============ INITIALIZE DATABASE ============
with app.app_context():
    init_db()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print("=" * 55)
    print("🎬 botDL - Video Downloader with Supabase")
    print("📍 Server: http://127.0.0.1:5000")
    print("🔐 Google Authentication Enabled")
    print("🐘 Database: Supabase PostgreSQL")
    print("=" * 55)
    app.run(debug=False, host='0.0.0.0', port=port)
