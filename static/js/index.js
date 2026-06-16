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
            div.onclick = () => {
                document.querySelectorAll('.quality-option').forEach(q => q.classList.remove('active'));
                div.classList.add('active');
                selectedFormat = found;
                showToast(`${quality} selected`);
            };
            if (!selectedFormat && quality === '1080p') div.click();
        }
        qualityGrid.appendChild(div);
    });
}

// ============ ANALYZE ============
async function analyzeVideo() {
    const url = urlInput?.value.trim();
    if (!url) {
        showToast('Please paste a URL', true);
        urlInput.style.borderColor = '#ff4444';
        setTimeout(() => urlInput.style.borderColor = '', 2000);
        return;
    }
    
    urlInput.style.borderColor = '';
    skeleton?.classList.add('active');
    videoPreview.style.display = 'none';
    qualitySection.style.display = 'none';
    downloadSection.style.display = 'none';
    selectedFormat = null;
    
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '⏳ Analyzing...';
    
    let platformName = 'video';
    if (url.includes('tiktok')) platformName = 'TikTok';
    else if (url.includes('instagram')) platformName = 'Instagram';
    else if (url.includes('facebook')) platformName = 'Facebook';
    else if (url.includes('youtube')) platformName = 'YouTube';
    
    showToast(`🔍 Analyzing ${platformName}...`);
    
    try {
        const res = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ url })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Analysis failed');
        }
        
        const data = await res.json();
        currentVideoData = data;
        
        thumbnail.src = data.thumbnail || 'https://placehold.co/160x90/1a1a2a/ffffff?text=No+Image';
        title.textContent = data.title || 'Unknown';
        platform.textContent = data.platform || 'Unknown';
        duration.textContent = data.duration || '--:--';
        uploader.textContent = data.uploader || '—';
        views.textContent = data.view_count ? `${data.view_count.toLocaleString()} views` : '— views';
        
        renderQualities(data.formats || []);
        
        skeleton.classList.remove('active');
        videoPreview.style.display = 'block';
        qualitySection.style.display = 'block';
        downloadSection.style.display = 'block';
        
        showToast(`✓ ${data.platform} video ready!`);
        
    } catch (err) {
        skeleton.classList.remove('active');
        showToast(err.message, true);
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = 'Analyze Video';
    }
}

// ============ DOWNLOAD ============
async function startDownload() {
    if (!currentVideoData || !selectedFormat) {
        showToast('Select a quality first', true);
        return;
    }
    
    if (!currentVideoData.url) {
        showToast('Missing URL. Analyze again.', true);
        return;
    }
    
    downloadBtn.disabled = true;
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressLabel.textContent = 'Connecting...';
    
    let progress = 0;
    const startTime = Date.now();
    
    const interval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 10;
            if (progress > 90) progress = 90;
            progressFill.style.width = `${progress}%`;
            progressPercent.textContent = `${Math.floor(progress)}%`;
            
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = (progress * 0.5) / elapsed;
            if (speed > 0) {
                progressLabel.textContent = `${speed.toFixed(1)} MB/s`;
            }
        }
    }, 300);
    
    try {
        const res = await fetch('/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                url: currentVideoData.url,
                format_id: selectedFormat.format_id,
                title_hint: currentVideoData.title
            })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Download failed');
        }
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(currentVideoData.title || 'video').substring(0, 50)}.${selectedFormat.ext || 'mp4'}`;
        a.click();
        URL.revokeObjectURL(url);
        
        clearInterval(interval);
        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        progressLabel.textContent = '✓ Complete!';
        
        addToHistory(currentVideoData.title, currentVideoData.thumbnail, selectedFormat.label);
        showToast('✓ Download complete!');
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
            progressPercent.textContent = '0%';
        }, 2000);
        
    } catch (err) {
        clearInterval(interval);
        showToast(err.message, true);
        progressContainer.style.display = 'none';
    } finally {
        downloadBtn.disabled = false;
    }
}

// ============ HISTORY ============
function addToHistory(videoTitle, thumbnailUrl, quality) {
    downloadHistory.unshift({
        id: Date.now(),
        title: (videoTitle || 'Unknown').substring(0, 40),
        thumbnail: thumbnailUrl,
        quality: quality,
        timestamp: new Date().toLocaleString()
    });
    if (downloadHistory.length > 10) downloadHistory.pop();
    localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory));
    renderHistory();
}

function renderHistory() {
    if (!historyList) return;
    if (!downloadHistory.length) {
        historyList.innerHTML = '<div class="empty-state">✨ No downloads yet</div>';
        return;
    }
    historyList.innerHTML = downloadHistory.map(item => `
        <div class="history-item">
            <img src="${item.thumbnail || 'https://placehold.co/60x40/1a1a2a/ffffff'}" onerror="this.src='https://placehold.co/60x40/1a1a2a/ffffff'">
            <div class="history-info">
                <div class="history-title">${escapeHtml(item.title)}</div>
                <div class="history-meta">${item.timestamp}</div>
            </div>
            <div class="history-quality">${item.quality}</div>
        </div>
    `).join('');
}

function clearHistory() {
    downloadHistory = [];
    localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory));
    renderHistory();
    showToast('History cleared');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
}

// ============ EVENTS ============
if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            urlInput.value = text;
            showToast('Link pasted!');
        } catch {
            showToast('Cannot paste', true);
        }
    });
}

if (closePreview) {
    closePreview.addEventListener('click', () => {
        videoPreview.style.display = 'none';
        qualitySection.style.display = 'none';
        downloadSection.style.display = 'none';
        currentVideoData = null;
        selectedFormat = null;
        urlInput.value = '';
    });
}

analyzeBtn?.addEventListener('click', analyzeVideo);
downloadBtn?.addEventListener('click', startDownload);
clearHistoryBtn?.addEventListener('click', clearHistory);
urlInput?.addEventListener('keypress', e => e.key === 'Enter' && analyzeVideo());

// ============ INIT ============
initName();
renderHistory();
checkAuth();

window.analyzeVideo = analyzeVideo;
window.startDownload = startDownload;
window.clearHistory = clearHistory;
