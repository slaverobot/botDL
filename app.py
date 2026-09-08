from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import re
import uuid
import tempfile
import requests
from bs4 import BeautifulSoup
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

# ============ COOKIES FILE ============
COOKIES_FILE = 'facebook_cookies.txt'

def get_facebook_cookies():
    """Get Facebook cookies from file"""
    if os.path.exists(COOKIES_FILE):
        return COOKIES_FILE
    return None

def get_facebook_cookies_content():
    """Read cookies content for view-source method"""
    if os.path.exists(COOKIES_FILE):
        try:
            with open(COOKIES_FILE, 'r') as f:
                return f.read()
        except:
            pass
    return None

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

def extract_video_from_source(html_content):
    """Try to extract video URL from Facebook page source"""
    # Look for video URLs in page source
    patterns = [
        r'https?://[^"\']+\.mp4[^"\']*',
        r'https?://[^"\']+/video/[^"\']+',
        r'hd_src:"([^"]+)"',
        r'sd_src:"([^"]+)"',
        r'browser_native_hd_url":"([^"]+)"',
        r'playable_url":"([^"]+)"',
        r'video src="([^"]+)"',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, html_content)
        for match in matches:
            # Clean up URL
            url = match.replace('\\/', '/').replace('\\u0025', '%')
            if url.startswith('http'):
                return url
    return None

def get_video_url_from_page(url, cookies_str=None):
    """Try to get video URL directly from page source"""
    try:
        headers = {
            'User-Agent': YDL_HEADERS['User-Agent'],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
        
        # If we have cookies, add them
        if cookies_str:
            cookies = {}
            for line in cookies_str.split('\n'):
                if line and not line.startswith('#') and '.facebook.com' in line:
                    parts = line.split('\t')
                    if len(parts) >= 7:
                        cookies[parts[5].strip()] = parts[6].strip()
            if cookies:
                response = requests.get(url, headers=headers, cookies=cookies, timeout=30)
            else:
                response = requests.get(url, headers=headers, timeout=30)
        else:
            response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            video_url = extract_video_from_source(response.text)
            if video_url:
                return video_url
    except:
        pass
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
    
    # === FACEBOOK SPECIAL HANDLING ===
    if platform == "Facebook":
        # First try: Use yt-dlp with cookies
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
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
            
            if info and info.get('formats'):
                formats = extract_formats(info, platform)
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
        except Exception as e:
            print(f"yt-dlp failed: {e}")
            # Continue to fallback methods
            pass
        
        # === FALLBACK 1: Try view-source extraction ===
        try:
            cookies_str = get_facebook_cookies_content()
            video_url = get_video_url_from_page(url, cookies_str)
            
            if video_url:
                # Found video URL directly
                formats = [{
                    'format_id': 'direct',
                    'label': 'Direct Video',
                    'ext': 'mp4',
                    'height': 720,
                    'filesize': None,
                    'unavailable': False,
                    'has_audio': True
                }]
                return jsonify({
                    'title': 'Facebook Video',
                    'thumbnail': '',
                    'duration': '--:--',
                    'platform': platform,
                    'uploader': 'Unknown',
                    'view_count': 0,
                    'url': video_url,
                    'formats': formats,
                    'is_direct': True
                })
        except Exception as e:
            print(f"View-source extraction failed: {e}")
            pass
        
        # === FALLBACK 2: User instructions ===
        return jsonify({
            'error': 'Facebook video formats not available. Please try these solutions:',
            'solutions': [
                '1. Make sure the video is PUBLIC - not private or friends-only',
                '2. Create a facebook_cookies.txt file with your Facebook cookies (login required)',
                '3. Try a different Facebook video URL (e.g., Reels work better)',
                '4. Use a Facebook video downloader website as alternative'
            ]
        }), 500
    
    # === OTHER PLATFORMS ===
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
        
        formats = extract_formats(info, platform)
        
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
        
    except Exception as e:
        print(f"Analyze error: {e}")
        return jsonify({'error': str(e)[:200]}), 500

def extract_formats(info, platform):
    """Extract formats from video info"""
    formats = []
    seen = set()
    
    quality_order = ['144p', '240p', '360p', '480p', '720p', '1080p', '2K', '4K', '8K']
    
    for f in info.get('formats', []):
        height = f.get('height')
        acodec = f.get('acodec', 'none')
        vcodec = f.get('vcodec', 'none')
        
        if height and vcodec != 'none':
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
    
    # Sort by quality
    formats.sort(key=lambda x: quality_order.index(x['label']) if x['label'] in quality_order else 999)
    
    # Add MP3 audio option
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
    
    return formats

# ============ VIDEO DOWNLOAD ROUTE ============
@app.route('/download', methods=['POST'])
def download_video():
    """Download video with selected format"""
    data = request.get_json()
    url = data.get('url', '').strip()
    format_id = data.get('format_id', '')
    title_hint = data.get('title_hint', 'video')
    is_direct = data.get('is_direct', False)
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    if not format_id:
        return jsonify({'error': 'No format selected'}), 400
    
    # Handle direct video URL (from view-source extraction)
    if is_direct or format_id == 'direct':
        try:
            response = requests.get(url, stream=True, headers=YDL_HEADERS, timeout=60)
            if response.status_code == 200:
                safe_title = re.sub(r'[^\w\s-]', '', title_hint)[:50]
                return send_file(
                    response.raw,
                    as_attachment=True,
                    download_name=f"{safe_title}.mp4",
                    mimetype='video/mp4'
                )
            return jsonify({'error': 'Failed to download direct video'}), 500
        except Exception as e:
            return jsonify({'error': str(e)[:200]}), 500
    
    is_audio = format_id == 'bestaudio/best'
    platform = get_platform(url)
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'headers': YDL_HEADERS,
        'user_agent': YDL_HEADERS['User-Agent'],
        'outtmpl': os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
        'merge_output_format': 'mp4',
    }
    
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
