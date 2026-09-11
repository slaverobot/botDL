import os


class Config:
    """Base configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'botdl-secret-key')
    
    # Check RENDER as string (environment vars are always strings)
    IS_RENDER = os.environ.get('RENDER', '').lower() == 'true'
    
    # Download directories
    if IS_RENDER:
        DOWNLOAD_DIR = '/tmp/downloads'
        MP3_DOWNLOAD_DIR = '/tmp/mp3_downloads'
    else:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        DOWNLOAD_DIR = os.path.join(BASE_DIR, "downloads")
        MP3_DOWNLOAD_DIR = os.path.join(BASE_DIR, "mp3_downloads")
    
    # YouTube headers
    YDL_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    # iTunes API for MP3 search
    ITUNES_API_URL = 'https://itunes.apple.com/search'
    
    # ============ JAMENDO API ============
    JAMENDO_CLIENT_ID = os.environ.get('JAMENDO_CLIENT_ID', '')
    JAMENDO_CLIENT_SECRET = os.environ.get('JAMENDO_CLIENT_SECRET', '')
    JAMENDO_API_URL = 'https://api.jamendo.com/v3.0'
    
    # Jamendo download settings
    JAMENDO_AUDIO_FORMAT = 'mp32'  # mp31 (96kbps), mp32 (VBR ~192kbps), ogg, flac
    JAMENDO_DEFAULT_LIMIT = 10
    JAMENDO_MAX_LIMIT = 200
