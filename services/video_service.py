import yt_dlp
import os
import re
import uuid
import tempfile
from config import Config


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
    return "Unknown"


def format_duration(seconds):
    """Format duration in MM:SS or HH:MM:SS"""
    if not seconds:
        return "00:00"
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"


def analyze_video(url):
    """Analyze video and return available formats"""
    platform = get_platform(url)
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'headers': Config.YDL_HEADERS,
        'user_agent': Config.YDL_HEADERS['User-Agent'],
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
    
    if not info:
        raise Exception('Could not fetch video info')
    
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
                formats.append({
                    'format_id': str(f.get('format_id')),
                    'label': label,
                    'height': height,
                    'ext': f.get('ext', 'mp4'),
                    'filesize': f.get('filesize'),
                    'unavailable': False,
                    'has_audio': acodec != 'none'
                })
    
    formats.sort(key=lambda x: quality_order.index(x['label']) if x['label'] in quality_order else 999)
    
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
    
    return {
        'title': info.get('title', 'Unknown Title'),
        'thumbnail': info.get('thumbnail', ''),
        'duration': format_duration(info.get('duration')),
        'platform': platform,
        'uploader': info.get('uploader', 'Unknown'),
        'view_count': info.get('view_count', 0),
        'url': url,
        'formats': formats
    }


def download_video_file(url, format_id, title_hint):
    """Download video and return file info"""
    is_audio = format_id == 'bestaudio/best'
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'headers': Config.YDL_HEADERS,
        'user_agent': Config.YDL_HEADERS['User-Agent'],
        'outtmpl': os.path.join(Config.DOWNLOAD_DIR, '%(title)s.%(ext)s'),
        'format_sort': ['codec:avc:m4a'],
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
        ydl_opts['format'] = format_id
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if not info:
            raise Exception('Download failed')
        
        filename = ydl.prepare_filename(info)
        
        if is_audio:
            base = os.path.splitext(filename)[0]
            for ext in ['.mp3']:
                test_file = base + ext
                if os.path.exists(test_file):
                    filename = test_file
                    break
        else:
            if not os.path.exists(filename):
                base = os.path.splitext(filename)[0]
                for ext in ['.mp4', '.mkv', '.webm']:
                    test_file = base + ext
                    if os.path.exists(test_file):
                        filename = test_file
                        break
        
        if not os.path.exists(filename):
            # Search in download directory
            for f in os.listdir(Config.DOWNLOAD_DIR):
                if info.get('title', '') in f:
                    filename = os.path.join(Config.DOWNLOAD_DIR, f)
                    break
        
        if not os.path.exists(filename):
            raise Exception('File not found after download')
        
        ext = os.path.splitext(filename)[1][1:]
        safe_title = re.sub(r'[^\w\s-]', '', title_hint)[:50]
        
        return {
            'file_path': filename,
            'filename': f"{safe_title}.{ext}",
            'mimetype': 'audio/mpeg' if is_audio else 'video/mp4'
        }


def convert_to_mp3(url, bitrate='192', title_hint='audio'):
    """Convert video to MP3 audio"""
    bitrate_map = {'128': '128', '192': '192', '320': '320', 'lossless': '0'}
    quality = bitrate_map.get(bitrate, '192')
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'headers': Config.YDL_HEADERS,
        'user_agent': Config.YDL_HEADERS['User-Agent'],
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': quality,
        }],
        'outtmpl': os.path.join(Config.DOWNLOAD_DIR, '%(title)s.%(ext)s'),
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if not info:
            raise Exception('Conversion failed')
        
        base = os.path.splitext(ydl.prepare_filename(info))[0]
        filename = f"{base}.mp3"
        
        if not os.path.exists(filename):
            raise Exception('MP3 file not found')
        
        safe_title = re.sub(r'[^\w\s-]', '', title_hint)[:50]
        
        return {
            'file_path': filename,
            'filename': f"{safe_title}.mp3"
        }