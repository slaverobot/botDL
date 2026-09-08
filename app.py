from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import re
import uuid
import tempfile
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'botdl-secret-key')
CORS(app)

# ============ YOUTUBE HEADERS ============
YDL_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
}

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
    elif "twitter.com" in url_lower or "x.com" in url_lower:
        return "Twitter"
    return "Unknown"

def format_duration(seconds):
    if not seconds:
        return "00:00"
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"

def get_facebook_cookies():
    """Try to get Facebook cookies from environment or file"""
    cookies_path = 'facebook_cookies.txt'
    if os.path.exists(cookies_path):
        return cookies_path
    return None

# ============ HEALTH CHECK ROUTE ============
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'botDL',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

# ============ MAIN ROUTE ============
@app.route('/')
def index():
    return render_template('index.html', user=None)

# ============ VIDEO ANALYSIS ROUTE ============
@app.route('/analyze', methods=['POST'])
def analyze_video():
    """Analyze video and return available formats"""
    data = request.get_json()
    url = data.get('url', '').strip()
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    platform = get_platform(url)
    
    # Special options for Facebook
    if platform == "Facebook":
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'headers': YDL_HEADERS,
            'user_agent': YDL_HEADERS['User-Agent'],
            'cookiefile': get_facebook_cookies(),
            'extractor_args': {
                'facebook': {
                    'allow_media_types': ['video'],
                    'prefer_dash_manifest': False,
                }
            }
        }
    else:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'headers': YDL_HEADERS,
            'user_agent': YDL_HEADERS['User-Agent'],
        }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        
        if not info:
            return jsonify({'error': 'Could not fetch video info'}), 500
        
        formats = []
        seen = set()
        
        # Quality order
        quality_order = ['144p', '240p', '360p', '480p', '720p', '1080p', '2K', '4K', '8K']
        
        # Get all formats with audio
        for f in info.get('formats', []):
            height = f.get('height')
            acodec = f.get('acodec', 'none')
            vcodec = f.get('vcodec', 'none')
            
            # For Facebook, some formats may not have acodec but still have audio
            # So we check if it's a video format (has height and vcodec)
            if height and vcodec != 'none':
                # Determine label
                if height <= 144:
                    label = '144p'
                elif height <= 240:
                    label = '240p'
                elif height <= 360:
                    label = '360p'
                elif height <= 480:
                    label = '480p'
                elif height <= 720:
                    label = '720p'
                elif height <= 1080:
                    label = '1080p'
                elif height <= 1440:
                    label = '2K'
                elif height <= 2160:
                    label = '4K'
                else:
                    label = '8K'
                
                if label not in seen:
                    seen.add(label)
                    # Check if format has audio
                    has_audio = acodec != 'none'
                    formats.append({
                        'format_id': str(f.get('format_id')),
                        'label': label,
                        'height': height,
                        'ext': f.get('ext', 'mp4'),
                        'filesize': f.get('filesize'),
                        'unavailable': False,
                        'has_audio': has_audio
                    })
        
        # If no formats found, try to get the best available
        if not formats:
            # Try to get any video format
            for f in info.get('formats', []):
                if f.get('vcodec') != 'none':
                    height = f.get('height') or 480
                    label = f'{height}p'
                    if label not in seen:
                        seen.add(label)
                        formats.append({
                            'format_id': str(f.get('format_id')),
                            'label': label,
                            'height': height,
                            'ext': f.get('ext', 'mp4'),
                            'filesize': f.get('filesize'),
                            'unavailable': False,
                            'has_audio': f.get('acodec') != 'none'
                        })
        
        # Sort formats by quality
        formats.sort(key=lambda x: quality_order.index(x['label']) if x['label'] in quality_order else 999)
        
        # Add MP3 Audio option (only if video formats exist)
        if formats:
            formats.append({
                'format_id': 'bestaudio/best',
                'label': 'MP3 Audio',
                'ext': 'mp3',
                'height': 0,
                'filesize': None,
                'unavailable': False,
                'has_audio': True
            })
        
        return jsonify({
            'title': info.get('title', 'Unknown Title'),
            'thumbnail': info.get('thumbnail', ''),
            'duration': format_duration(info.get('duration')),
            'platform': platform,
            'uploader': info.get('uploader', 'Unknown'),
            'view_count': info.get('view_count', 0),
            'url': url,
            'formats': formats
        })
        
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        if "No video formats" in error_msg:
            return jsonify({
                'error': 'Facebook video formats not available. Try downloading using a different method or check if the video is public.',
                'suggestion': 'Make sure the video is public and not restricted.'
            }), 500
        return jsonify({'error': error_msg[:200]}), 500
    except Exception as e:
        print(f"Analyze error: {e}")
        return jsonify({'error': str(e)[:200]}), 500

# ============ VIDEO DOWNLOAD ROUTE ============
@app.route('/download', methods=['POST'])
def download_video():
    """Download video with selected format"""
    data = request.get_json()
    url = data.get('url', '').strip()
    format_id = data.get('format_id', '')
    title_hint = data.get('title_hint', 'video')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    if not format_id:
        return jsonify({'error': 'No format selected'}), 400
    
    is_audio = format_id == 'bestaudio/best'
    platform = get_platform(url)
    
    # Base options
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'headers': YDL_HEADERS,
        'user_agent': YDL_HEADERS['User-Agent'],
        'outtmpl': os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
        'merge_output_format': 'mp4',
    }
    
    # Special options for Facebook
    if platform == "Facebook":
        ydl_opts['cookiefile'] = get_facebook_cookies()
        ydl_opts['extractor_args'] = {
            'facebook': {
                'allow_media_types': ['video'],
                'prefer_dash_manifest': False,
            }
        }
    
    if is_audio:
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }]
    else:
        ydl_opts['format'] = format_id
        ydl_opts['format_sort'] = ['codec:avc:m4a']
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            if not info:
                return jsonify({'error': 'Download failed'}), 500
            
            downloaded_file = None
            filename = ydl.prepare_filename(info)
            
            if is_audio:
                base = os.path.splitext(filename)[0]
                for ext in ['.mp3', '.m4a']:
                    test_file = base + ext
                    if os.path.exists(test_file):
                        downloaded_file = test_file
                        break
            else:
                if os.path.exists(filename):
                    downloaded_file = filename
                else:
                    base = os.path.splitext(filename)[0]
                    for ext in ['.mp4', '.mkv', '.webm']:
                        test_file = base + ext
                        if os.path.exists(test_file):
                            downloaded_file = test_file
                            break
            
            if not downloaded_file or not os.path.exists(downloaded_file):
                # Search in download directory
                for f in os.listdir(DOWNLOAD_DIR):
                    if info.get('title', '') in f:
                        downloaded_file = os.path.join(DOWNLOAD_DIR, f)
                        break
                    elif f.endswith('.mp3') and is_audio:
                        downloaded_file = os.path.join(DOWNLOAD_DIR, f)
                        break
            
            if not downloaded_file or not os.path.exists(downloaded_file):
                return jsonify({'error': 'File not found'}), 500
            
            ext = os.path.splitext(downloaded_file)[1][1:]
            safe_title = re.sub(r'[^\w\s-]', '', title_hint)[:50]
            
            response = send_file(
                downloaded_file,
                as_attachment=True,
                download_name=f"{safe_title}.{ext}",
                mimetype='audio/mpeg' if is_audio else 'video/mp4'
            )
            
            @response.call_on_close
            def cleanup():
                try:
                    if os.path.exists(downloaded_file):
                        os.remove(downloaded_file)
                except:
                    pass
            
            return response
                
    except Exception as e:
        print(f"Download error: {e}")
        return jsonify({'error': str(e)[:200]}), 500

# ============ MP3 CONVERTER ROUTE ============
@app.route('/convert-to-mp3', methods=['POST'])
def convert_to_mp3():
    """Convert video to MP3 audio only"""
    data = request.get_json()
    url = data.get('url', '').strip()
    bitrate = data.get('bitrate', '192')
    title_hint = data.get('title_hint', 'audio')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    bitrate_map = {
        '128': '128',
        '192': '192',
        '320': '320',
        'lossless': '0'
    }
    
    quality = bitrate_map.get(bitrate, '192')
    platform = get_platform(url)
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'headers': YDL_HEADERS,
        'user_agent': YDL_HEADERS['User-Agent'],
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': quality,
        }],
        'outtmpl': os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
    }
    
    if platform == "Facebook":
        ydl_opts['cookiefile'] = get_facebook_cookies()
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            if not info:
                return jsonify({'error': 'Conversion failed'}), 500
            
            downloaded_file = None
            base = os.path.splitext(ydl.prepare_filename(info))[0]
            
            for ext in ['.mp3']:
                test_file = base + ext
                if os.path.exists(test_file):
                    downloaded_file = test_file
                    break
            
            if not downloaded_file or not os.path.exists(downloaded_file):
                return jsonify({'error': 'MP3 file not found'}), 500
            
            safe_title = re.sub(r'[^\w\s-]', '', title_hint)[:50]
            
            response = send_file(
                downloaded_file,
                as_attachment=True,
                download_name=f"{safe_title}.mp3",
                mimetype='audio/mpeg'
            )
            
            @response.call_on_close
            def cleanup():
                try:
                    if os.path.exists(downloaded_file):
                        os.remove(downloaded_file)
                except:
                    pass
            
            return response
                
    except Exception as e:
        print(f"MP3 conversion error: {e}")
        return jsonify({'error': str(e)[:200]}), 500

# ============ MAIN ============
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("=" * 55)
    print("🎬 botDL - Video Downloader")
    print(f"📍 Server: http://0.0.0.0:{port}")
    print("📥 No Login Required - Public Access")
    print("=" * 55)
    app.run(debug=False, host='0.0.0.0', port=port)
