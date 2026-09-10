from flask import Blueprint, render_template, jsonify
from datetime import datetime

main_bp = Blueprint('main', __name__)


@main_bp.route('/health')
def health_check():
    """Health check endpoint for Render"""
    return jsonify({
        'status': 'healthy',
        'service': 'botDL',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


@main_bp.route('/')
def index():
    """Home page - Video Downloader"""
    return render_template('index.html', user=None)