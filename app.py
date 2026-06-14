from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, session
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
import yt_dlp
import os
import re
import uuid
from datetime import datetime

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
CORS(app)

# ============ DATABASE SETUP ============
if os.environ.get('RENDER'):
    DATABASE_URL = os.environ.get('DATABASE_URL')
else:
    DATABASE_URL = 'sqlite:///botdl.db'

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ============ LOGIN MANAGER ============
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# ============ OAUTH SETUP - FIXED ============
oauth = OAuth(app)

# Google OAuth with FULL configuration
google = oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    access_token_url='https://oauth2.googleapis.com/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    userinfo_endpoint='https://www.googleapis.com/oauth2/v1/userinfo',
    client_kwargs={'scope': 'openid email profile'},
    jwks_uri='https://www.googleapis.com/oauth2/v3/certs'
)

# ============ MODELS ============
class User(UserMixin, db.Model):
    id = db.Column(db.String(100), primary_key=True)
    email = db.Column(db.String(200), unique=True, nullable=False)
    name = db.Column(db.String(200))
    picture = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_premium = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)

class DownloadHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100), db.ForeignKey('user.id'))
    video_url = db.Column(db.String(500))
    video_title = db.Column(db.String(500))
    video_thumbnail = db.Column(db.String(500))
    video_quality = db.Column(db.String(50))
    download_date = db.Column(db.DateTime, default=datetime.utcnow)

class Favorite(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100), db.ForeignKey('user.id'))
    video_url = db.Column(db.String(500))
    video_title = db.Column(db.String(500))
    video_thumbnail = db.Column(db.String(500))
    added_date = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

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
        # Get token
        token = google.authorize_access_token()
        
        # Get user info using the token
        userinfo = google.get('userinfo')
        user_info = userinfo.json()
        
        # Check if user exists
        user = User.query.get(user_info['id'])
        if not user:
            user = User(
                id=user_info['id'],
                email=user_info['email'],
                name=user_info.get('name', 'User'),
                picture=user_info.get('picture', '')
            )
            db.session.add(user)
            db.session.commit()
        
        login_user(user)
        session['user_id'] = user.id
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
    history = DownloadHistory.query.filter_by(user_id=current_user.id).order_by(DownloadHistory.download_date.desc()).limit(5).all()
    favorites = Favorite.query.filter_by(user_id=current_user.id).all()
    history_count = DownloadHistory.query.filter_by(user_id=current_user.id).count()
    favorites_count = len(favorites)
    member_since = current_user.created_at.strftime('%b %Y')
    
    return render_template('dashboard/home.html', 
                         user=current_user, 
                         recent_downloads=history,
                         history_count=history_count,
                         favorites_count=favorites_count,
                         member_since=member_since)

@app.route('/dashboard/history')
@login_required
def history_page():
    history = DownloadHistory.query.filter_by(user_id=current_user.id).order_by(DownloadHistory.download_date.desc()).all()
    return render_template('dashboard/history.html', user=current_user, history=history)

@app.route('/dashboard/favorites')
@login_required
def favorites_page():
    favorites = Favorite.query.filter_by(user_id=current_user.id).all()
    return render_template('dashboard/favorites.html', user=current_user, favorites=favorites)

@app.route('/dashboard/profile')
@login_required
def profile_page():
    history_count = DownloadHistory.query.filter_by(user_id=current_user.id).count()
    favorites_count = Favorite.query.filter_by(user_id=current_user.id).count()
    return render_template('dashboard/profile.html', 
                         user=current_user, 
                         history_count=history_count, 
                         favorites_count=favorites_count)

# ============ API ROUTES ============
@app.route('/api/favorite/add', methods=['POST'])
@login_required
def add_favorite():
    data = request.get_json()
    existing = Favorite.query.filter_by(user_id=current_user.id, video_url=data.get('url')).first()
    if not existing:
        fav = Favorite(
            user_id=current_user.id,
            video_url=data.get('url'),
            video_title=data.get('title', 'Unknown'),
            video_thumbnail=data.get('thumbnail', '')
        )
        db.session.add(fav)
        db.session.commit()
    return jsonify({'success': True})

@app.route('/api/favorite/remove', methods=['POST'])
@login_required
def remove_favorite():
    data = request.get_json()
    fav = Favorite.query.filter_by(user_id=current_user.id, video_url=data.get('url')).first()
    if fav:
        db.session.delete(fav)
        db.session.commit()
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
            history = DownloadHistory(
                user_id=current_user.id,
                video_url=url,
                video_title=info.get('title', 'Unknown'),
                video_thumbnail=info.get('thumbnail', ''),
                video_quality=''
            )
            db.session.add(history)
            db.session.commit()
        
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

# ============ CREATE DATABASE TABLES ============
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    print("=" * 55)
    print("🎬 botDL - Video Downloader with Authentication")
    print("📍 Server: http://127.0.0.1:5000")
    print("🔐 Google Authentication Enabled")
    print("=" * 55)
    app.run(debug=True, port=5000, host='0.0.0.0')
