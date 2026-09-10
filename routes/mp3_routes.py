from flask import Blueprint, request, jsonify, send_file, render_template
from services.mp3_service import search_music, download_full_song

mp3_bp = Blueprint('mp3', __name__)


@mp3_bp.route('/downloads')
def downloads_page():
    """MP3 downloads page"""
    return render_template('download.html', user=None)


@mp3_bp.route('/api/mp3/search', methods=['POST'])
def search():
    """Search for music by artist or song name"""
    data = request.get_json()
    query = data.get('query', '').strip()
    
    if not query:
        return jsonify({'error': 'No search query provided'}), 400
    
    try:
        results = search_music(query)
        return jsonify({
            'success': True,
            'count': len(results),
            'results': results
        })
    except Exception as e:
        print(f"Search error: {e}")
        return jsonify({'error': str(e)[:200]}), 500


@mp3_bp.route('/api/mp3/download', methods=['POST'])
def download():
    """Download FULL MP3 song via yt-dlp"""
    data = request.get_json()
    title = data.get('title', '').strip()
    artist = data.get('artist', '').strip()
    
    if not title:
        return jsonify({'error': 'No title provided'}), 400
    
    try:
        result = download_full_song(title, artist)
        return send_file(
            result['file_path'],
            as_attachment=True,
            download_name=result['filename'],
            mimetype='audio/mpeg'
        )
    except Exception as e:
        print(f"Download error: {e}")
        return jsonify({'error': str(e)[:200]}), 500