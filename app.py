from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import re
import uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ============ DOWNLOAD DIRECTORY SETUP ============
# Kwa Render (production) au local development
if os.environ.get('RENDER'):
    DOWNLOAD_DIR = '/tmp/downloads'
else:
    DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), "downloads")

os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def get_platform(url):
    """Detect video platform from URL"""
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
    else:
        return "Unknown"

def format_duration(seconds):
    """Convert seconds to readable format"""
    if not seconds:
        return "00:00"
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"

@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze video URL and return available formats"""
    data = request.get_json()
    url = data.get('url', '').strip()
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    # Anti-bot protection for YouTube and other platforms
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web'],  # Android client bypasses some restrictions
                'skip': ['webpage', 'hls', 'dash']     # Skip problematic formats
            },
            'tiktok': {
                'extractor_args': {
                    'headers': ['User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36']
                }
            }
        },
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'format': 'best[ext=mp4]/best',  # Prefer mp4 format
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        
        if not info:
            return jsonify({'error': 'Could not extract video information'}), 400
        
        # Collect available formats
        formats = []
        seen_qualities = set()
        
        # Quality mapping
        quality_map = {
            144: '144p', 240: '240p', 360: '360p', 480: '480p',
            720: '720p', 1080: '1080p', 1440: '1440p (2K/QHD)',
            2160: '2160p (4K UHD)', 2880: '2880p (5K)', 4320: '4320p (8K UHD)'
        }
        
        # Premium qualities list
        premium_qualities = ['2K', 'QHD', '1440p', '4K', '2160p', '5K', '2880p', '8K', '4320p']
        
        for f in info.get('formats', []):
            height = f.get('height')
            vcodec = f.get('vcodec', 'none')
            acodec = f.get('acodec', 'none')
            
            # Include formats that have video (with or without audio)
            if height and vcodec != 'none' and height <= 4320:
                # Find closest quality label
                closest_height = min(quality_map.keys(), key=lambda x: abs(x - height))
                label = quality_map[closest_height]
                
                # Mark premium qualities
                is_premium = any(pq in label for pq in premium_qualities)
                
                if label not in seen_qualities:
                    seen_qualities.add(label)
                    formats.append({
                        'format_id': str(f.get('format_id')),
                        'label': label,
                        'quality': label,
                        'ext': f.get('ext', 'mp4'),
                        'type': 'video',
                        'height': height,
                        'premium': is_premium,
                        'has_audio': acodec != 'none'
                    })
        
        # Sort by height
        formats.sort(key=lambda x: x.get('height', 0))
        
        # Add MP3 audio option
        formats.append({
            'format_id': 'bestaudio/best',
            'label': 'MP3 Audio',
            'quality': 'mp3',
            'ext': 'mp3',
            'type': 'audio',
            'premium': False
        })
        
        # Ensure all standard qualities are represented
        standard_qualities = ['144p', '240p', '360p', '480p', '720p', '1080p', 
                              '1440p (2K/QHD)', '2160p (4K UHD)', '2880p (5K)', '4320p (8K UHD)']
        
        existing_labels = [f['label'] for f in formats]
        for sq in standard_qualities:
            if sq not in existing_labels:
                is_premium = any(pq in sq for pq in premium_qualities)
                formats.append({
                    'format_id': 'best',
                    'label': sq,
                    'quality': sq,
                    'ext': 'mp4',
                    'type': 'video',
                    'unavailable': True,
                    'premium': is_premium
                })
        
        # Get thumbnail
        thumbnail = info.get('thumbnail', '')
        if not thumbnail and info.get('thumbnails'):
            thumbnails = info.get('thumbnails', [])
            if thumbnails:
                thumbnail = thumbnails[-1].get('url', '')
        
        result = {
            'title': info.get('title', 'Unknown Title'),
            'thumbnail': thumbnail,
            'duration': format_duration(info.get('duration')),
            'platform': get_platform(url),
            'uploader': info.get('uploader', 'Unknown'),
            'view_count': info.get('view_count', 0),
            'url': url,
            'formats': formats
        }
        
        return jsonify(result)
        
    except Exception as e:
        error_msg = str(e)
        # Handle YouTube anti-bot error gracefully
        if "Sign in to confirm" in error_msg or "bot" in error_msg.lower():
            return jsonify({'error': 'YouTube anti-bot protection detected. Try a different video or use TikTok/Instagram/Facebook.'}), 400
        return jsonify({'error': f'Analysis failed: {error_msg[:150]}'}), 500

@app.route('/download', methods=['POST'])
def download():
    """Download video in selected format"""
    data = request.get_json()
    url = data.get('url', '').strip()
    format_id = data.get('format_id', '')
    title = data.get('title_hint', 'video')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    download_id = str(uuid.uuid4())[:8]
    is_audio = format_id == 'bestaudio/best'
    
    try:
        if is_audio:
            output_template = os.path.join(DOWNLOAD_DIR, f'{download_id}.%(ext)s')
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': output_template,
                'quiet': True,
                'no_warnings': True,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android'],
                        'skip': ['webpage', 'hls', 'dash']
                    }
                },
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }]
            }
        else:
            output_template = os.path.join(DOWNLOAD_DIR, f'{download_id}.%(ext)s')
            
            # Quality to height mapping
            quality_height = {
                '144p': 144, '240p': 240, '360p': 360, '480p': 480,
                '720p': 720, '1080p': 1080, '1440p': 1440, '2K': 1440,
                '2160p': 2160, '4K': 2160, '2880p': 2880, '5K': 2880,
                '4320p': 4320, '8K': 4320
            }
            
            # Extract height from format label if possible
            height = None
            for key, val in quality_height.items():
                if key in str(format_id):
                    height = val
                    break
            
            # Use best format that doesn't require merging when possible
            if height and height <= 1080:
                # For 1080p and below, try to get direct format with audio
                format_str = f'best[height<={height}][ext=mp4]/best[height<={height}]'
            elif height and height <= 4320:
                format_str = f'bestvideo[height<={height}]+bestaudio/best'
            else:
                format_str = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
            
            ydl_opts = {
                'format': format_str,
                'outtmpl': output_template,
                'quiet': True,
                'no_warnings': True,
                'merge_output_format': 'mp4',
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android'],
                        'skip': ['webpage', 'hls', 'dash']
                    }
                },
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }
        
        # Execute download
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
        
        # Find downloaded file
        downloaded_file = None
        for file in os.listdir(DOWNLOAD_DIR):
            if file.startswith(download_id):
                downloaded_file = os.path.join(DOWNLOAD_DIR, file)
                break
        
        if not downloaded_file or not os.path.exists(downloaded_file):
            return jsonify({'error': 'Download failed - file not found'}), 500
        
        # Determine file extension
        ext = downloaded_file.split('.')[-1] if '.' in downloaded_file else 'mp4'
        
        # Clean filename for download
        safe_title = re.sub(r'[^\w\s-]', '', title)[:50]
        safe_title = re.sub(r'[\s]+', '_', safe_title)
        download_name = f"{safe_title}.{ext}"
        
        # Send file and cleanup after
        response = send_file(
            downloaded_file,
            as_attachment=True,
            download_name=download_name,
            mimetype='audio/mpeg' if ext == 'mp3' else 'video/mp4'
        )
        
        @response.call_on_close
        def cleanup():
            try:
                if os.path.exists(downloaded_file):
                    os.remove(downloaded_file)
                    print(f"Cleaned up: {downloaded_file}")
            except Exception as e:
                print(f"Cleanup error: {e}")
        
        return response
        
    except Exception as e:
        # Cleanup on error
        for file in os.listdir(DOWNLOAD_DIR):
            if file.startswith(download_id):
                try:
                    os.remove(os.path.join(DOWNLOAD_DIR, file))
                except:
                    pass
        error_msg = str(e)
        if "Sign in to confirm" in error_msg or "bot" in error_msg.lower():
            return jsonify({'error': 'YouTube anti-bot protection. Try a different video or platform like TikTok/Instagram.'}), 500
        return jsonify({'error': f'Download failed: {error_msg[:150]}'}), 500

@app.route('/progress/<download_id>')
def get_progress(download_id):
    """Get download progress"""
    return jsonify({'status': 'completed', 'percent': 100})

# Add cache control headers
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

if __name__ == '__main__':
    print("=" * 55)
    print("🎬 botDL - Social Media Video Downloader")
    print("📍 Server: http://127.0.0.1:5000")
    print("🎨 Theme: Black, White & Green")
    print("👑 Premium: 2K, 4K, 5K, 8K & Batch Downloads")
    print("📱 Free: 144p - 1080p")
    print("🔊 Audio: MP3 supported")
    print("🤖 Anti-bot protection enabled for YouTube")
    print("=" * 55)
    app.run(debug=True, port=5000, host='0.0.0.0', threaded=True)
