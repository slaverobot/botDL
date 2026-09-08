from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import re
import uuid
import tempfile
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'botdl-secret-key'
CORS(app)

# ============ YOUTUBE HEADERS ============
YDL_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
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
    
    # Simple yt-dlp options that work
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
        
        # Extract available formats
        formats = []
        seen = set()
        
        # Get video formats with audio
        for f in info.get('formats', []):
            height = f.get('height')
            acodec = f.get('acodec', 'none')
            vcodec = f.get('vcodec', 'none')
            
            if height and vcodec != 'none' and acodec != 'none':
                label = f'{height}p'
                if label not in seen:
                    seen.add(label)
                    formats.append({
                        'format_id': str(f.get('format_id')),
                        'label': label,
                        'ext': f.get('ext', 'mp4'),
                        'filesize': f.get('filesize'),
                        'unavailable': False
                    })
        
        # Add MP3 audio option
        formats.append({
            'format_id': 'bestaudio/best',
            'label': 'MP3 Audio',
            'ext': 'mp3',
            'filesize': None,
            'unavailable': False
        })
        
        # Sort by quality (highest first)
        formats.sort(key=lambda x: int(x['label'].replace('p', '')) if x['label'].replace('p', '').isdigit() else 0, reverse=True)
        
        return jsonify({
            'title': info.get('title', 'Unknown Title'),
            'thumbnail': info.get('thumbnail', ''),
            'duration': format_duration(info.get('duration')),
            'platform': get_platform(url),
            'uploader': info.get('uploader', 'Unknown'),
            'view_count': info.get('view_count', 0),
            'url': url,
            'formats': formats[:10]
        })
        
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
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'headers': YDL_HEADERS,
        'user_agent': YDL_HEADERS['User-Agent'],
        'outtmpl': os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
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
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            if not info:
                return jsonify({'error': 'Download failed'}), 500
            
            # Find downloaded file
            downloaded_file = None
            filename = ydl.prepare_filename(info)
            
            if is_audio:
                # For audio, the file will be .mp3
                base = os.path.splitext(filename)[0]
                for ext in ['.mp3', '.m4a', '.webm']:
                    test_file = base + ext
                    if os.path.exists(test_file):
                        downloaded_file = test_file
                        break
            else:
                if os.path.exists(filename):
                    downloaded_file = filename
            
            if not downloaded_file or not os.path.exists(downloaded_file):
                # Search in download directory
                for f in os.listdir(DOWNLOAD_DIR):
                    if info.get('title', '') in f or f.endswith('.mp3'):
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
            
            # Clean up after sending
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
    
    # Map bitrate
    bitrate_map = {
        '128': '128',
        '192': '192',
        '320': '320',
        'lossless': '0'
    }
    
    quality = bitrate_map.get(bitrate, '192')
    
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
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            if not info:
                return jsonify({'error': 'Conversion failed'}), 500
            
            # Find MP3 file
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
    print("=" * 55)
    print("🎬 botDL - Video Downloader")
    print("📍 Server: http://127.0.0.1:5000")
    print("📥 No Login Required - Public Access")
    print("=" * 55)
    app.run(debug=True, port=5000, host='0.0.0.0')
