import requests
import os
import re
import time
import yt_dlp
from config import Config


# ============ CACHE ============
_search_cache = {}
CACHE_DURATION = 3600  # 1 hour


# ============ SEARCH MUSIC (iTunes with cache) ============
def search_music(query, limit=24):
    """
    Search for music using iTunes API with caching
    Returns list of songs with metadata (30-sec preview only)
    """
    if not query or not query.strip():
        raise Exception('Search query is required')
    
    query = query.strip().lower()
    
    # Check cache
    cache_key = f"{query}_{limit}"
    if cache_key in _search_cache:
        cached_time, cached_data = _search_cache[cache_key]
        if time.time() - cached_time < CACHE_DURATION:
            print(f"✅ Cache hit for: {query}")
            return cached_data
    
    params = {
        'term': query,
        'media': 'music',
        'limit': limit,
        'country': 'US'
    }
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(
            Config.ITUNES_API_URL,
            params=params,
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 403:
            raise Exception('Rate limit reached. Please wait a minute and try again.')
        
        response.raise_for_status()
        data = response.json()
        
        results = []
        for item in data.get('results', []):
            # Skip if no preview URL
            if not item.get('previewUrl'):
                continue
            
            artwork = item.get('artworkUrl100', '')
            artwork = artwork.replace('100x100', '300x300')
            
            results.append({
                'track_id': item.get('trackId'),
                'title': item.get('trackName', 'Unknown Title'),
                'artist': item.get('artistName', 'Unknown Artist'),
                'album': item.get('collectionName', ''),
                'artwork': artwork,
                'preview_url': item.get('previewUrl', ''),
                'duration_ms': item.get('trackTimeMillis', 0),
                'genre': item.get('primaryGenreName', ''),
                'release_date': item.get('releaseDate', ''),
            })
        
        # Save to cache
        _search_cache[cache_key] = (time.time(), results)
        
        # Limit cache size
        if len(_search_cache) > 100:
            oldest_key = min(_search_cache.keys(),
                             key=lambda k: _search_cache[k][0])
            del _search_cache[oldest_key]
        
        return results
        
    except requests.exceptions.Timeout:
        raise Exception('Search request timed out. Please try again.')
    except requests.exceptions.RequestException as e:
        raise Exception(f'Search failed: {str(e)[:100]}')


# ============ DOWNLOAD FULL SONG (yt-dlp from YouTube) ============
def download_full_song(title, artist):
    """
    Download FULL song using yt-dlp from YouTube
    Returns file info
    """
    if not title:
        raise Exception('Song title is required')
    
    # Create search query
    search_query = f"{title} {artist}".strip()
    print(f"🔍 Searching full song: {search_query}")
    
    # Output template
    output_template = os.path.join(
        Config.MP3_DOWNLOAD_DIR,
        '%(title)s.%(ext)s'
    )
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': output_template,
        'default_search': 'ytsearch1',
        'noplaylist': True,
        'extract_flat': False,
        'headers': Config.YDL_HEADERS,
        'user_agent': Config.YDL_HEADERS['User-Agent'],
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web', 'ios'],
                'skip': ['hls', 'dash'],
            }
        },
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Search and download
            info = ydl.extract_info(f"ytsearch1:{search_query}", download=True)
            
            if not info:
                raise Exception('No results found')
            
            # Get first entry
            if 'entries' in info and info['entries']:
                video = info['entries'][0]
            else:
                video = info
            
            # Find MP3 file
            filename = ydl.prepare_filename(video)
            base = os.path.splitext(filename)[0]
            mp3_file = f"{base}.mp3"
            
            if not os.path.exists(mp3_file):
                # Try to find any MP3 in directory
                for f in os.listdir(Config.MP3_DOWNLOAD_DIR):
                    if f.endswith('.mp3') and title.lower()[:10] in f.lower():
                        mp3_file = os.path.join(Config.MP3_DOWNLOAD_DIR, f)
                        break
                else:
                    raise Exception('Downloaded file not found')
            
            # Create safe filename
            safe_artist = sanitize_filename(artist or 'Unknown')
            safe_title = sanitize_filename(title)
            final_filename = f"{safe_artist} - {safe_title}.mp3"
            
            return {
                'file_path': mp3_file,
                'filename': final_filename,
                'file_size': os.path.getsize(mp3_file)
            }
            
    except yt_dlp.utils.DownloadError as e:
        print(f"yt-dlp error: {e}")
        raise Exception(f'Could not download full song. Try again.')
    except Exception as e:
        print(f"Download error: {e}")
        raise Exception(f'Download failed: {str(e)[:100]}')


# ============ HELPER: SANITIZE FILENAME ============
def sanitize_filename(name):
    """Remove invalid characters from filename"""
    if not name:
        return 'audio'
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name.strip()[:80]