from flask import Blueprint, request, jsonify, send_file
from services.video_service import (
    analyze_video,
    download_video_file,
    convert_to_mp3 as convert_video_to_mp3
)

video_bp = Blueprint('video', __name__)


@video_bp.route('/analyze', methods=['POST'])
def analyze():
    """Analyze video and return available formats"""
    data = request.get_json()
    url = data.get('url', '').strip()
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    try:
        result = analyze_video(url)
        return jsonify(result)
    except Exception as e:
        print(f"Analyze error: {e}")
        return jsonify({'error': str(e)[:200]}), 500


@video_bp.route('/download', methods=['POST'])
def download():
    """Download video with selected format"""
    data = request.get_json()
    url = data.get('url', '').strip()
    format_id = data.get('format_id', '')
    title_hint = data.get('title_hint', 'video')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    if not format_id:
        return jsonify({'error': 'No format selected'}), 400
    
    try:
        result = download_video_file(url, format_id, title_hint)
        return send_file(
            result['file_path'],
            as_attachment=True,
            download_name=result['filename'],
            mimetype=result['mimetype']
        )
    except Exception as e:
        print(f"Download error: {e}")
        return jsonify({'error': str(e)[:200]}), 500


@video_bp.route('/convert-to-mp3', methods=['POST'])
def convert_to_mp3():
    """Convert video to MP3 audio only"""
    data = request.get_json()
    url = data.get('url', '').strip()
    bitrate = data.get('bitrate', '192')
    title_hint = data.get('title_hint', 'audio')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    try:
        result = convert_video_to_mp3(url, bitrate, title_hint)
        return send_file(
            result['file_path'],
            as_attachment=True,
            download_name=result['filename'],
            mimetype='audio/mpeg'
        )
    except Exception as e:
        print(f"MP3 conversion error: {e}")
        return jsonify({'error': str(e)[:200]}), 500