// ============= STORE DATA =============
let currentVideoData = null;
let selectedFormat = null;
let downloadHistory = JSON.parse(localStorage.getItem('downloadHistory') || '[]');

// ============= LETTER JUMPING ANIMATION =============
const fullName = "Mohamed Watitu";
let currentLetterIndex = 0;
let animationInterval = null;
const animatedNameElement = document.getElementById('animatedName');

const jumpColors = ['#00ff44', '#00ff88', '#00ffaa', '#00ffcc', '#00ffee'];

function jumpLetter(span, color) {
    if (!span) return;
    span.classList.add('jumping');
    span.style.color = color;
    setTimeout(() => {
        if (span) {
            span.classList.remove('jumping');
            span.style.color = '';
        }
    }, 500);
}

function jumpNextLetter() {
    if (!animatedNameElement) return;
    const spans = animatedNameElement.querySelectorAll('.letter-jump');
    if (spans.length === 0) return;
    const currentSpan = spans[currentLetterIndex];
    if (currentSpan && currentSpan.textContent.trim() !== '') {
        jumpLetter(currentSpan, jumpColors[currentLetterIndex % jumpColors.length]);
    }
    currentLetterIndex++;
    if (currentLetterIndex >= spans.length) currentLetterIndex = 0;
}

function initAnimatedName() {
    if (!animatedNameElement) return;
    animatedNameElement.innerHTML = '';
    fullName.split('').forEach(letter => {
        const span = document.createElement('span');
        span.textContent = letter;
        span.className = 'letter-jump';
        if (letter === ' ') span.style.width = '0.3rem';
        animatedNameElement.appendChild(span);
    });
    if (animationInterval) clearInterval(animationInterval);
    animationInterval = setInterval(jumpNextLetter, 700);
}

// ============= DOM ELEMENTS =============
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
const downloadSpeed = document.getElementById('downloadSpeed');
const timeRemaining = document.getElementById('timeRemaining');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// ============= USER MENU DROPDOWN =============
const userMenu = document.querySelector('.user-menu');
if (userMenu) {
    userMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenu.classList.toggle('active');
    });
    document.addEventListener('click', () => {
        userMenu.classList.remove('active');
    });
}

// ============= TOAST FUNCTIONS =============
function showToast(message, isError = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.innerHTML = `<span>${isError ? '⚠️ ' : '✅ '}${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ============= AUTH UI UPDATE FUNCTIONS =============
function updateUIForLoggedInUser(user) {
    const authContainer = document.querySelector('.auth-buttons');
    if (authContainer) {
        authContainer.innerHTML = `
            <div class="user-menu">
                <img src="${user.picture}" class="user-avatar" style="width: 32px; height: 32px; border-radius: 50%;">
                <span>${user.name.split(' ')[0]}</span>
                <a href="/dashboard" class="btn-dashboard">Dashboard</a>
                <a href="/logout" class="btn-logout">Logout</a>
            </div>
        `;
    }
}

function updateUIForLoggedOutUser() {
    const authContainer = document.querySelector('.auth-buttons');
    if (authContainer) {
        authContainer.innerHTML = `
            <a href="/login" class="btn-login">Sign In</a>
            <a href="/login" class="btn-signup">Create Account</a>
        `;
    }
}

// ============= CHECK AUTH STATUS =============
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const user = await response.json();
            console.log('User logged in:', user.email);
            updateUIForLoggedInUser(user);
            return true;
        } else {
            console.log('User not logged in');
            updateUIForLoggedOutUser();
            return false;
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        updateUIForLoggedOutUser();
        return false;
    }
}

// ============= RENDER QUALITIES =============
function renderQualities(formats) {
    if (!qualityGrid) return;
    qualityGrid.innerHTML = '';
    
    const qualityGroups = [
        { label: '🎵 Audio', qualities: ['MP3'] },
        { label: '📱 SD', qualities: ['144p', '240p', '360p', '480p'] },
        { label: '🎬 HD', qualities: ['720p', '1080p'] },
        { label: '✨ Ultra HD', qualities: ['2K', '4K', '8K'] }
    ];
    
    qualityGroups.forEach(group => {
        group.qualities.forEach(quality => {
            let found = formats.find(f => f.label.includes(quality));
            const div = document.createElement('div');
            div.className = 'quality-option';
            div.innerHTML = `<span>${quality}</span>`;
            
            if (!found || found.unavailable) {
                div.style.opacity = '0.4';
                div.style.cursor = 'not-allowed';
                div.onclick = () => showToast(`${quality} not available for this video`, true);
            } else {
                div.onclick = () => {
                    document.querySelectorAll('.quality-option').forEach(q => q.classList.remove('active'));
                    div.classList.add('active');
                    selectedFormat = found;
                    showToast(`${quality} selected`, false);
                };
                if (!selectedFormat && quality === '1080p') div.click();
            }
            qualityGrid.appendChild(div);
        });
    });
}

// ============= ANALYZE VIDEO =============
async function analyzeVideo() {
    const url = urlInput?.value.trim();
    if (!url) {
        showToast('Please paste a video URL', true);
        urlInput.style.borderColor = '#ff4444';
        setTimeout(() => urlInput.style.borderColor = '', 2000);
        return;
    }
    
    urlInput.style.borderColor = '';
    skeleton?.classList.add('active');
    if (videoPreview) videoPreview.style.display = 'none';
    if (qualitySection) qualitySection.style.display = 'none';
    if (downloadSection) downloadSection.style.display = 'none';
    
    if (analyzeBtn) {
        analyzeBtn.classList.add('loading');
        analyzeBtn.disabled = true;
    }
    
    let detectedPlatform = 'video';
    if (url.includes('tiktok')) detectedPlatform = 'TikTok';
    else if (url.includes('instagram')) detectedPlatform = 'Instagram';
    else if (url.includes('facebook')) detectedPlatform = 'Facebook';
    else if (url.includes('youtube')) detectedPlatform = 'YouTube';
    else if (url.includes('twitter') || url.includes('x.com')) detectedPlatform = 'Twitter';
    
    showToast(`🔍 Analyzing ${detectedPlatform} video...`, false);
    
    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to analyze video');
        }
        
        const data = await response.json();
        currentVideoData = data;
        
        if (thumbnail) thumbnail.src = data.thumbnail || 'https://placehold.co/160x90/1a1a2a/ffffff?text=No+Image';
        if (title) title.textContent = data.title || 'Unknown Title';
        if (platform) platform.textContent = data.platform || 'Unknown';
        if (duration) duration.textContent = data.duration || '--:--';
        if (uploader) uploader.textContent = data.uploader || 'Unknown';
        if (views) views.textContent = data.view_count ? `${data.view_count.toLocaleString()} views` : '— views';
        
        renderQualities(data.formats || []);
        
        if (skeleton) skeleton.classList.remove('active');
        if (videoPreview) videoPreview.style.display = 'block';
        if (qualitySection) qualitySection.style.display = 'block';
        if (downloadSection) downloadSection.style.display = 'block';
        
        showToast(`✓ ${data.platform} video ready for download!`, false);
        
    } catch (error) {
        if (skeleton) skeleton.classList.remove('active');
        showToast(error.message, true);
    } finally {
        if (analyzeBtn) {
            analyzeBtn.classList.remove('loading');
            analyzeBtn.disabled = false;
        }
    }
}

// ============= DOWNLOAD WITH PROGRESS =============
async function startDownload() {
    if (!currentVideoData || !selectedFormat) {
        showToast('Please select a quality first', true);
        return;
    }
    
    if (downloadBtn) downloadBtn.disabled = true;
    if (progressContainer) progressContainer.classList.add('active');
    if (progressFill) progressFill.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressLabel) progressLabel.textContent = 'Connecting...';
    if (downloadSpeed) downloadSpeed.textContent = '— MB/s';
    if (timeRemaining) timeRemaining.textContent = '— remaining';
    
    let progress = 0;
    let startTime = Date.now();
    
    const interval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 8;
            if (progress > 90) progress = 90;
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressPercent) progressPercent.textContent = `${Math.floor(progress)}%`;
            
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = (progress * 0.5) / elapsed;
            if (downloadSpeed && speed > 0) downloadSpeed.textContent = `${speed.toFixed(1)} MB/s`;
            if (timeRemaining && progress > 0) {
                const remaining = ((100 - progress) * elapsed) / progress;
                if (remaining < 60) {
                    timeRemaining.textContent = `${Math.ceil(remaining)} sec remaining`;
                } else {
                    timeRemaining.textContent = `${Math.ceil(remaining / 60)} min remaining`;
                }
            }
        }
        if (progressLabel && progress < 50) progressLabel.textContent = 'Downloading...';
    }, 300);
    
    try {
        const response = await fetch('/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: currentVideoData.url,
                format_id: selectedFormat.format_id,
                title_hint: currentVideoData.title
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Download failed');
        }
        
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${currentVideoData.title.substring(0, 50)}.${selectedFormat.ext || 'mp4'}`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
        
        clearInterval(interval);
        if (progressFill) progressFill.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressLabel) progressLabel.textContent = 'Complete!';
        if (downloadSpeed) downloadSpeed.textContent = '✓ Done';
        if (timeRemaining) timeRemaining.textContent = '';
        
        addToHistory(currentVideoData.title, currentVideoData.thumbnail, selectedFormat.label);
        showToast('✓ Download complete!');
        
        setTimeout(() => {
            if (progressContainer) progressContainer.classList.remove('active');
            if (progressFill) progressFill.style.width = '0%';
            if (progressPercent) progressPercent.textContent = '0%';
        }, 2000);
        
    } catch (error) {
        clearInterval(interval);
        showToast(error.message, true);
        if (progressContainer) progressContainer.classList.remove('active');
        if (progressLabel) progressLabel.textContent = 'Download failed';
    } finally {
        if (downloadBtn) downloadBtn.disabled = false;
    }
}

// ============= HISTORY FUNCTIONS =============
function addToHistory(videoTitle, thumbnailUrl, quality) {
    downloadHistory.unshift({
        id: Date.now(),
        title: videoTitle.substring(0, 40),
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
    if (downloadHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-history">✨ No downloads yet. Start by pasting a video link above.</div>';
        return;
    }
    historyList.innerHTML = downloadHistory.map(item => `
        <div class="history-item">
            <img src="${item.thumbnail || 'https://placehold.co/60x40/1a1a2a/ffffff?text=No+Image'}" onerror="this.src='https://placehold.co/60x40/1a1a2a/ffffff?text=No+Image'">
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
    showToast('History cleared', false);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
}

// ============= CLOSE PREVIEW =============
if (closePreview) {
    closePreview.addEventListener('click', () => {
        if (videoPreview) videoPreview.style.display = 'none';
        if (qualitySection) qualitySection.style.display = 'none';
        if (downloadSection) downloadSection.style.display = 'none';
        currentVideoData = null;
        selectedFormat = null;
        if (urlInput) urlInput.value = '';
    });
}

// ============= EVENT LISTENERS =============
if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (urlInput) urlInput.value = text;
            showToast('Link pasted! Ready to analyze', false);
            if (urlInput) urlInput.style.borderColor = '#00ff44';
            setTimeout(() => {
                if (urlInput) urlInput.style.borderColor = '';
            }, 1000);
        } catch {
            showToast('Cannot paste. Please copy the link first', true);
        }
    });
}

if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeVideo);
if (downloadBtn) downloadBtn.addEventListener('click', startDownload);
if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);
if (urlInput) urlInput.addEventListener('keypress', e => e.key === 'Enter' && analyzeVideo());

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// ============= INTERSECTION OBSERVER FOR ANIMATIONS =============
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.feature-card, .platform-card, .analysis-card').forEach(el => {
    if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease';
        observer.observe(el);
    }
});

// ============= PAGE LOAD ANIMATION =============
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.5s ease';
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
});

// ============= INITIALIZATION =============
initAnimatedName();
renderHistory();
checkAuthStatus();

// Expose functions globally
window.analyzeVideo = analyzeVideo;
window.startDownload = startDownload;
window.clearHistory = clearHistory;
