// ============ DATA ============
let currentVideoData = null;
let selectedFormat = null;
let downloadHistory = JSON.parse(localStorage.getItem('downloadHistory') || '[]');

// ============ LETTER JUMPING ============
const fullName = "Mohamed Watitu";
let letterIndex = 0;
let animInterval = null;
const nameEl = document.getElementById('animatedName');

const colors = ['#00ff44', '#00ffaa', '#00ffcc', '#00ff88', '#00ffee'];

function jumpLetter(span, color) {
    if (!span) return;
    span.classList.add('jumping');
    span.style.color = color;
    setTimeout(() => {
        span.classList.remove('jumping');
        span.style.color = '';
    }, 500);
}

function jumpNext() {
    if (!nameEl) return;
    const spans = nameEl.querySelectorAll('.letter-jump');
    if (!spans.length) return;
    const current = spans[letterIndex];
    if (current && current.textContent.trim()) {
        jumpLetter(current, colors[letterIndex % colors.length]);
    }
    letterIndex++;
    if (letterIndex >= spans.length) letterIndex = 0;
}

function initName() {
    if (!nameEl) return;
    nameEl.innerHTML = '';
    fullName.split('').forEach(letter => {
        const span = document.createElement('span');
        span.textContent = letter;
        span.className = 'letter-jump';
        if (letter === ' ') span.style.width = '0.3rem';
        nameEl.appendChild(span);
    });
    if (animInterval) clearInterval(animInterval);
    animInterval = setInterval(jumpNext, 700);
}

// ============ DOM ============
const urlInput = document.getElementById('urlInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const pasteBtn = document.getElementById('pasteBtn');
const closePreview = document.getElementById('closePreview');
const videoPreview = document.getElementById('videoPreview');
const qualitySection = document.getElementById('qualitySection');
const downloadSection = document.getElementById('downloadSection');
const qualityGrid = document.getElementById('qualityGrid');
const thumbnail = document.getElementById('thumbnail');
const title = document.getElementById('title');
const platform = document.getElementById('platform');
const duration = document.getElementById('duration');
const uploader = document.getElementById('uploader');
const views = document.getElementById('views');
const skeleton = document.getElementById('skeleton');
const downloadBtn = document.getElementById('downloadBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const progressLabel = document.getElementById('progressLabel');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// ============ TOAST ============
function showToast(msg, isError = false) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ============ AUTH STATUS ============
async function checkAuth() {
    try {
        const res = await fetch('/api/user', { credentials: 'include' });
        if (res.ok) {
            const user = await res.json();
            console.log('✅ Logged in:', user.email);
            return true;
        }
    } catch (e) {}
    return false;
}

// ============ RENDER QUALITIES ============
function renderQualities(formats) {
    if (!qualityGrid) return;
    qualityGrid.innerHTML = '';
    
    const allQualities = ['144p', '240p', '360p', '480p', '720p', '1080p', '2K', '4K', '8K', 'MP3'];
    
    allQualities.forEach(quality => {
        const found = formats.find(f => f.label === quality);
        const div = document.createElement('div');
        div.className = 'quality-option';
        div.textContent = quality;
        
        if (!found) {
            div.style.opacity = '0.3';
            div.style.cursor = 'not-allowed';
            div.onclick = () => showToast(`${quality} not available`, true);
        } else {
            div.onclick
