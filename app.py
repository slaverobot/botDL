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

def find_best_720p_format(formats):
    """Find the best 720p format with audio. If not found, return best available with audio."""
    # First, try to find 720p with audio
    for f in formats:
        height = f.get('height')
        acodec = f.get('acodec', 'none')
        vcodec = f.get('vcodec', 'none')
        if height and vcodec != 'none' and acodec != 'none':
            # Check if it's 720p (height between 700 and 730)
            if 700 <= height <= 730:
                return f
    
    # If no 720p, try to find the highest quality with audio
    best = None
    best_height = 0
    for f in formats:
        height = f.get('height')
        acodec = f.get('acodec', 'none')
        vcodec = f.get('vcodec', 'none')
        if height and vcodec != 'none' and acodec != 'none':
            if height > best_height:
                best_height = height
                best = f
    
    return best

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
    """Analyze video and return available formats - 720p default"""
    data = request.get_json()
    url = data.get('url', '').strip()
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
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
        
        # Track available qualities
        available_qualities = []
        
        for f in info.get('formats', []):
            height = f.get('height')
            acodec = f.get('acodec', 'none')
            vcodec = f.get('vcodec', 'none')
            
            # Only include formats with BOTH video and audio
            if height and vcodec != 'none' and acodec != 'none':
                label = f'{height}p'
                if label not in seen:
                    seen.add(label)
                    available_qualities.append(height)
                    formats.append({
                        'format_id': str(f.get('format_id')),
                        'label': label,
                        'height': height,
                        'ext': f.get('ext', 'mp4'),
                        'filesize': f.get('filesize'),
                        'unavailable': False,
                        'has_audio': True
                    })
        
        # Sort formats by height (highest first)
        formats.sort(key=lambda x: x.get('height', 0), reverse=True)
        
        # Find if 720p is available
        has_720p = any(700 <= f.get('height', 0) <= 730 for f in formats)
        
        # If no 720p, find the best available quality with audio
        if not has_720p and formats:
            best_format = formats[0]  # Highest quality available
            best_format['default'] = True
            best_format['label'] = f"{best_format.get('height', 0)}p (Best Available)"
        
        # Mark 720p as default if available
        for f in formats:
            if 700 <= f.get('height', 0) <= 730:
                f['default'] = True
                break
        
        # Add MP3 audio option
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
            'platform': get_platform(url),
            'uploader': info.get('uploader', 'Unknown'),
            'view_count': info.get('view_count', 0),
            'url': url,
            'formats': formats[:12],
            'has_720p': has_720p
        })
        
    except Exception as e:
        print(f"Analyze error: {e}")
        return jsonify({'error': str(e)[:200]}), 500

# ============ VIDEO DOWNLOAD ROUTE ============
@app.route('/download', methods=['POST'])
def download_video():
    """Download video with selected format - 720p fallback if format fails"""
    data = request.get_json()
    url = data.get('url', '').strip()
    format_id = data.get('format_id', '')
    title_hint = data.get('title_hint', 'video')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    if not format_id:
        return jsonify({'error': 'No format selected'}), 400
    
    is_audio = format_id == 'bestaudio/best'
    
    try:
        # First, get video info to find available formats
        ydl_opts_info = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'headers': YDL_HEADERS,
            'user_agent': YDL_HEADERS['User-Agent'],
        }
        
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if not info:
                return jsonify({'error': 'Could not fetch video info'}), 500
            
            # Find the best 720p format for fallback
            all_formats = info.get('formats', [])
            fallback_format = None
            
            # Try to find 720p with audio
            for f in all_formats:
                height = f.get('height')
                acodec = f.get('acodec', 'none')
                vcodec = f.get('vcodec', 'none')
                if height and vcodec != 'none' and acodec != 'none':
                    if 700 <= height <= 730:
                        fallback_format = f
                        break
            
            # If no 720p, find best available with audio
            if not fallback_format:
                best_height = 0
                for f in all_formats:
                    height = f.get('height')
                    acodec = f.get('acodec', 'none')
                    vcodec = f.get('vcodec', 'none')
                    if height and vcodec != 'none' and acodec != 'none':
                        if height > best_height:
                            best_height = height
                            fallback_format = f
        
        # Prepare download options
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'headers': YDL_HEADERS,
            'user_agent': YDL_HEADERS['User-Agent'],
            'outtmpl': os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
            'format_sort': ['res:720', 'codec:avc:m4a'],
            'merge_output_format': 'mp4',
        }
        
        if is_audio:
            ydl_opts['format'] = 'bestaudio/best'
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
        else:
            # Try selected format first, if it fails, use fallback
            ydl_opts['format'] = format_id
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=True)
            except Exception as e:
                # If download fails with selected format, try fallback
                print(f"Download failed with format {format_id}, trying fallback...")
                
                if fallback_format and not is_audio:
                    # Use fallback 720p format
                    fallback_id = str(fallback_format.get('format_id'))
                    ydl_opts['format'] = fallback_id
                    
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl_fallback:
                        info = ydl_fallback.extract_info(url, download=True)
                else:
                    raise e
            
            if not info:
                return jsonify({'error': 'Download failed'}), 500
            
            # Find downloaded file
            downloaded_file = None
            filename = ydl.prepare_filename(info)
            
            if is_audio:
                base = os.path.splitext(filename)[0]
                for ext in ['.mp3', '.m4a', '.webm']:
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
        
        # Final fallback: Try downloading with best format that has audio
        try:
            ydl_opts_fallback = {
                'quiet': True,
                'no_warnings': True,
                'headers': YDL_HEADERS,
                'user_agent': YDL_HEADERS['User-Agent'],
                'outtmpl': os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
                'format': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
                'merge_output_format': 'mp4',
            }
            
            with yt_dlp.YoutubeDL(ydl_opts_fallback) as ydl:
                info = ydl.extract_info(url, download=True)
                
                if info:
                    downloaded_file = ydl.prepare_filename(info)
                    if os.path.exists(downloaded_file):
                        safe_title = re.sub(r'[^\w\s-]', '', title_hint)[:50]
                        return send_file(
                            downloaded_file,
                            as_attachment=True,
                            download_name=f"{safe_title}.mp4",
                            mimetype='video/mp4'
                        )
        except:
            pass
        
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
