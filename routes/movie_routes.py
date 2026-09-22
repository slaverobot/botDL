from flask import Blueprint, render_template, request, jsonify, send_file, Response
import requests
import os
import re
import tempfile
from datetime import datetime

movie_bp = Blueprint('movie', __name__, url_prefix='/movies')


# ============ MOVIE CONFIG (Tofauti na config nyingine) ============
class MovieConfig:
    """Config ya movie page pekee - haishirikiani na config nyingine"""
    
    # TMDB API (The Movie Database) - kwa metadata
    TMDB_API_KEY = os.environ.get('TMDB_API_KEY', '')
    TMDB_API_URL = 'https://api.themoviedb.org/3'
    TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'
    
    # Movie download directory
    if os.environ.get('RENDER'):
        MOVIE_DIR = '/tmp/movies'
    else:
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        MOVIE_DIR = os.path.join(BASE_DIR, "movie_data")
    
    # Headers
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }


# Hakikisha directory ipo
os.makedirs(MovieConfig.MOVIE_DIR, exist_ok=True)


# ============ MOVIE PAGE ROUTE ============
@movie_bp.route('/')
def movie_page():
    """Onyesha movie page"""
    return render_template('movies.html')


# ============ MOVIE SEARCH ROUTE ============
@movie_bp.route('/api/search')
def movie_search():
    """Tafuta movie kwa jina"""
    query = request.args.get('q', '').strip()
    
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    if not MovieConfig.TMDB_API_KEY:
        return jsonify({'error': 'TMDB API key not configured'}), 500
    
    url = f"{MovieConfig.TMDB_API_URL}/search/movie"
    params = {
        'api_key': MovieConfig.TMDB_API_KEY,
        'query': query,
        'language': 'en-US',
        'page': 1
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        movies = []
        for movie in data.get('results', [])[:20]:
            movies.append({
                'id': movie.get('id'),
                'title': movie.get('title'),
                'overview': movie.get('overview', ''),
                'release_date': movie.get('release_date', ''),
                'year': movie.get('release_date', '')[:4] if movie.get('release_date') else '',
                'poster': f"{MovieConfig.TMDB_IMAGE_BASE}{movie.get('poster_path')}" if movie.get('poster_path') else '',
                'rating': movie.get('vote_average', 0),
                'popularity': movie.get('popularity', 0)
            })
        
        return jsonify({
            'movies': movies,
            'total': len(movies),
            'query': query
        })
        
    except Exception as e:
        print(f"Movie search error: {e}")
        return jsonify({'error': str(e)[:200]}), 500


# ============ MOVIE DETAILS ROUTE ============
@movie_bp.route('/api/details/<int:movie_id>')
def movie_details(movie_id):
    """Pata maelezo kamili ya movie"""
    if not MovieConfig.TMDB_API_KEY:
        return jsonify({'error': 'TMDB API key not configured'}), 500
    
    url = f"{MovieConfig.TMDB_API_URL}/movie/{movie_id}"
    params = {
        'api_key': MovieConfig.TMDB_API_KEY,
        'language': 'en-US',
        'append_to_response': 'videos,credits'
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        # Tafuta trailer ya YouTube
        trailer_key = None
        for video in data.get('videos', {}).get('results', []):
            if video.get('type') == 'Trailer' and video.get('site') == 'YouTube':
                trailer_key = video.get('key')
                break
        
        return jsonify({
            'id': data.get('id'),
            'title': data.get('title'),
            'overview': data.get('overview', ''),
            'release_date': data.get('release_date', ''),
            'runtime': data.get('runtime', 0),
            'rating': data.get('vote_average', 0),
            'poster': f"{MovieConfig.TMDB_IMAGE_BASE}{data.get('poster_path')}" if data.get('poster_path') else '',
            'backdrop': f"https://image.tmdb.org/t/p/original{data.get('backdrop_path')}" if data.get('backdrop_path') else '',
            'genres': [g.get('name') for g in data.get('genres', [])],
            'trailer_key': trailer_key,
            'cast': [c.get('name') for c in data.get('credits', {}).get('cast', [])[:10]]
        })
        
    except Exception as e:
        print(f"Movie details error: {e}")
        return jsonify({'error': str(e)[:200]}), 500


# ============ MOVIE DOWNLOAD ROUTE (YTS Magnet) ============
@movie_bp.route('/api/download/<int:movie_id>')
def movie_download(movie_id):
    """
    Rudisha magnet link kutoka YTS - user anaipakua kwa torrent client
    
    Hii ni legal zaidi kwa sababu:
    - botDL haihifadhi movie file
    - User anadownload kwa torrent client yake
    """
    if not MovieConfig.TMDB_API_KEY:
        return jsonify({'error': 'TMDB API key not configured'}), 500
    
    try:
        # Hatua 1: Pata movie details kutoka TMDB
        details_url = f"{MovieConfig.TMDB_API_URL}/movie/{movie_id}"
        details_res = requests.get(details_url, params={
            'api_key': MovieConfig.TMDB_API_KEY,
            'language': 'en-US'
        }, timeout=10)
        movie = details_res.json()
        title = movie.get('title', '')
        year = movie.get('release_date', '')[:4]
        
        if not title:
            return jsonify({'error': 'Movie title not found'}), 404
        
        # Hatua 2: Tafuta kwenye YTS API
        yts_url = 'https://yts.mx/api/v2/list_movies.json'
        yts_params = {
            'query_term': title,
            'limit': 5
        }
        
        yts_res = requests.get(yts_url, params=yts_params, timeout=10)
        yts_data = yts_res.json()
        
        movies_list = yts_data.get('data', {}).get('movies', [])
        
        if not movies_list:
            return jsonify({
                'error': f'Movie "{title}" not found on YTS',
                'hint': 'Try a different movie or check spelling'
            }), 404
        
        # Chagua movie inayofanana zaidi (kwa year)
        best_movie = movies_list[0]
        for m in movies_list:
            if str(m.get('year')) == str(year):
                best_movie = m
                break
        
        torrents = best_movie.get('torrents', [])
        if not torrents:
            return jsonify({'error': 'No torrents available'}), 404
        
        # Chagua quality nzuri (1080p > 720p > nyingine)
        best_torrent = None
        for quality in ['1080p', '720p', '480p']:
            for t in torrents:
                if t.get('quality') == quality:
                    best_torrent = t
                    break
            if best_torrent:
                break
        
        if not best_torrent:
            best_torrent = torrents[0]
        
        # Tengeneza magnet link
        torrent_hash = best_torrent.get('hash')
        magnet_url = f"magnet:?xt=urn:btih:{torrent_hash}&dn={title}+({year})"
        
        return jsonify({
            'success': True,
            'title': title,
            'year': year,
            'quality': best_torrent.get('quality'),
            'size': best_torrent.get('size'),
            'type': best_torrent.get('type', 'web'),
            'seeds': best_torrent.get('seeds', 0),
            'peers': best_torrent.get('peers', 0),
            'magnet_url': magnet_url,
            'torrent_url': best_torrent.get('url'),
            'message': 'Copy magnet link and open in qBittorrent, uTorrent, or any torrent client.'
        })
        
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timeout. Try again.'}), 504
    except Exception as e:
        print(f"Movie download error: {e}")
        return jsonify({'error': str(e)[:200]}), 500


# ============ MOVIE HEALTH CHECK ============
@movie_bp.route('/health')
def movie_health():
    """Health check ya movie module pekee"""
    return jsonify({
        'status': 'healthy',
        'module': 'movies',
        'tmdb_configured': bool(MovieConfig.TMDB_API_KEY),
        'timestamp': datetime.utcnow().isoformat()
    }), 200
