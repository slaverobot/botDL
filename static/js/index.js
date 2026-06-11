// ============= STORE DATA =============
let currentVideoData = null;
let selectedFormat = null;
let isPremium = localStorage.getItem('isPremium') === 'true';
let downloadHistory = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
let batchQueue = [];
let isBatchDownloading = false;

// Premium qualities (2K and above)
const PREMIUM_QUALITIES = ['2K', 'QHD', '1440p', '4K', '2160p', '5K', '2880p', '8K', '4320p'];

// ============= LETTER JUMPING ANIMATION =============
const fullName = "Mohamed Watitu";
let currentLetterIndex = 0;
let animationInterval = null;
const animatedNameElement = document.getElementById('animatedName');

// Colors for each letter jump
const jumpColors = [
    '#00ff44', '#ffaa00', '#ff44aa', '#44ffaa', '#aa44ff',
    '#ff6644', '#44aaff', '#ff44ff', '#aaff44', '#00ff44',
    '#ffaa44', '#44ffaa', '#ff44aa', '#44aaff', '#ff6644',
    '#00ff88', '#ff8844', '#88ff44', '#ff4488', '#44ff88'
];

// Function to make a single letter jump
function jumpLetter(letterSpan, color) {
    if (!letterSpan) return;
    
    // Add jumping class
    letterSpan.classList.add('jumping');
    
    // Change color
    letterSpan.style.color = color;
    
    // Remove jumping class after animation (0.6 seconds)
    setTimeout(() => {
        if (letterSpan) {
            letterSpan.classList.remove('jumping');
            // Reset color to default
            letterSpan.style.color = '';
        }
    }, 600);
}

// Function to jump the next letter
function jumpNextLetter() {
    if (!animatedNameElement) return;
    
    // Get all letter spans
    const letterSpans = animatedNameElement.querySelectorAll('.letter-jump');
    
    if (letterSpans.length === 0) return;
    
    // Get current letter span
    const currentSpan = letterSpans[currentLetterIndex];
    
    if (currentSpan && currentSpan.textContent.trim() !== '') {
        // Get color for this letter
        const colorIndex = currentLetterIndex % jumpColors.length;
        // Make the letter jump
        jumpLetter(currentSpan, jumpColors[colorIndex]);
    }
    
    // Move to next letter
    currentLetterIndex++;
    
    // If we've reached the end, start over
    if (currentLetterIndex >= letterSpans.length) {
        currentLetterIndex = 0;
    }
}

// Function to initialize the animated name
function initAnimatedName() {
    if (!animatedNameElement) return;
    
    // Clear the element
    animatedNameElement.innerHTML = '';
    
    // Split the name into individual letters
    const letters = fullName.split('');
    
    // Create spans for each letter
    letters.forEach((letter) => {
        const span = document.createElement('span');
        span.textContent = letter;
        span.className = 'letter-jump';
        
        // Handle spaces
        if (letter === ' ') {
            span.style.width = '0.5rem';
            span.style.display = 'inline-block';
            span.style.textAlign = 'center';
        }
        
        animatedNameElement.appendChild(span);
    });
    
    // Start the animation interval (every 0.8 seconds)
    if (animationInterval) clearInterval(animationInterval);
    animationInterval = setInterval(jumpNextLetter, 800);
}

// ============= DOM ELEMENTS =============
const urlInput = document.getElementById('urlInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const pasteBtn = document.getElementById('pasteBtn');
const videoPreview = document.getElementById('videoPreview');
const qualitySection = document.getElementById('qualitySection');
const downloadSection = document.getElementById('downloadSection');
const qualityGrid = document.getElementById('qualityGrid');
const thumbnail = document.getElementById('thumbnail');
const title = document.getElementById('title');
const platform = document.getElementById('platform');
const duration = document.getElementById('duration');
const views = document.getElementById('views');
const skeleton = document.getElementById('skeleton');
const downloadBtn = document.getElementById('downloadBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const premiumBtn = document.getElementById('premiumBtn');
const premiumModal = document.getElementById('premiumModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const subscribeMonthBtn = document.getElementById('subscribeMonthBtn');
const subscribeYearBtn = document.getElementById('subscribeYearBtn');
const batchSection = document.getElementById('batchSection');
const batchUrlInput = document.getElementById('batchUrlInput');
const batchAddBtn = document.getElementById('batchAddBtn');
const batchList = document.getElementById('batchList');
const batchDownloadBtn = document.getElementById('batchDownloadBtn');
const batchPauseBtn = document.getElementById('batchPauseBtn');
const batchProgress = document.getElementById('batchProgress');
const batchStatus = document.getElementById('batchStatus');
const clearBatchBtn = document.getElementById('clearBatchBtn');

// ============= HELPER FUNCTIONS =============

// Update premium badge
function updatePremiumBadge() {
    const badge = document.getElementById('premiumBadge');
    if (badge) {
        if (isPremium) {
            badge.textContent = '👑 Premium Active (2K - 8K)';
            badge.classList.add('premium');
        } else {
            badge.textContent = '🔓 Free (144p - 1080p)';
            badge.classList.remove('premium');
        }
    }
    
    const premiumNavBtn = document.getElementById('premiumBtn');
    if (isPremium && premiumNavBtn) {
        premiumNavBtn.innerHTML = '<span class="crown">👑</span> Premium Active';
        premiumNavBtn.style.opacity = '0.7';
    }
    
    if (batchSection && isPremium) {
        batchSection.classList.add('show');
    } else if (batchSection) {
        batchSection.classList.remove('show');
    }
}

// Show toast notification
function showToast(message, isError = false, isPremiumNotice = false) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (isPremiumNotice) toast.classList.add('toast-premium');
    toast.textContent = message;
    toast.style.background = isError ? '#441111' : (isPremiumNotice ? '#1a1a1a' : '#0a2e1a');
    toast.style.borderLeftColor = isError ? '#ff4444' : (isPremiumNotice ? '#ffaa00' : '#00ff44');
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Show premium payment modal
function showPremiumRequired(quality) {
    showToast(`🔒 ${quality} requires Premium subscription! Upgrade now to unlock 2K, 4K, 5K, 8K & batch downloads.`, false, true);
    if (premiumModal) premiumModal.classList.add('active');
}

// Check if a quality is premium
function isQualityPremium(qualityLabel) {
    const normalizedLabel = qualityLabel.toUpperCase();
    return PREMIUM_QUALITIES.some(pq => normalizedLabel.includes(pq));
}

// Render quality options
function renderQualities(formats) {
    if (!qualityGrid) return;
    qualityGrid.innerHTML = '';
    
    const standardQualities = [
        '144p', '240p', '360p', '480p', '720p', '1080p',
        '1440p (2K/QHD)', '2160p (4K UHD)', '2880p (5K)', '4320p (8K UHD)'
    ];
    
    standardQualities.forEach(quality => {
        let foundFormat = null;
        for (const format of formats) {
            const formatLabel = format.label;
            if (formatLabel.includes(quality.split(' ')[0]) || quality.includes(formatLabel.split(' ')[0])) {
                foundFormat = format;
                break;
            }
        }
        
        const isPremiumQuality = quality.includes('2K') || quality.includes('1440p') ||
                                 quality.includes('4K') || quality.includes('2160p') ||
                                 quality.includes('5K') || quality.includes('2880p') ||
                                 quality.includes('8K') || quality.includes('4320p');
        
        const div = document.createElement('div');
        div.className = 'quality-option';
        div.textContent = isPremiumQuality ? quality + ' 👑' : quality;
        
        if (isPremiumQuality && !isPremium) {
            div.classList.add('premium-locked');
            div.onclick = () => showPremiumRequired(quality);
        } else if (!foundFormat || foundFormat.unavailable) {
            div.style.opacity = '0.4';
            div.style.cursor = 'not-allowed';
            div.title = 'Quality not available for this video';
            div.onclick = () => showToast(`${quality} not available for this video`, true);
        } else {
            div.onclick = () => {
                document.querySelectorAll('.quality-option').forEach(q => q.classList.remove('active'));
                div.classList.add('active');
                selectedFormat = foundFormat;
            };
            if (!selectedFormat && !isPremiumQuality) div.click();
        }
        
        qualityGrid.appendChild(div);
    });
}

// ============= BATCH DOWNLOAD SYSTEM =============

// Add URL to batch queue
async function addBatchUrl() {
    if (!isPremium) {
        showPremiumRequired('Batch download');
        return;
    }
    
    const url = batchUrlInput?.value.trim();
    if (!url) {
        showToast('Please enter a video URL', true);
        return;
    }
    
    showToast('📥 Analyzing video...', false);
    
    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });
        
        if (!response.ok) throw new Error('Failed to analyze');
        
        const data = await response.json();
        
        const batchItem = {
            id: Date.now() + Math.random(),
            url: url,
            title: data.title || 'Unknown Video',
            thumbnail: data.thumbnail,
            duration: data.duration,
            formats: data.formats,
            selectedFormat: null,
            status: 'pending',
            progress: 0,
            error: null
        };
        
        // Auto-select first free quality
        const firstFreeFormat = data.formats?.find(f => !isQualityPremium(f.label));
        if (firstFreeFormat) batchItem.selectedFormat = firstFreeFormat;
        
        batchQueue.push(batchItem);
        renderBatchList();
        batchUrlInput.value = '';
        showToast(`✓ "${data.title.substring(0, 40)}" added to batch`);
        
    } catch (error) {
        showToast('Failed to analyze URL: ' + error.message, true);
    }
}

// Remove item from batch queue
function removeBatchItem(id) {
    if (isBatchDownloading) {
        showToast('Cannot remove while downloading', true);
        return;
    }
    batchQueue = batchQueue.filter(item => item.id !== id);
    renderBatchList();
    updateBatchStats();
}

// Update quality for a batch item
function updateBatchItemQuality(itemId, format) {
    const item = batchQueue.find(i => i.id === itemId);
    if (item) {
        item.selectedFormat = format;
        renderBatchList();
    }
}

// Render batch quality selector
function renderBatchQualitySelector(item) {
    if (!item.formats || item.formats.length === 0) {
        return '<div style="color: #888; font-size: 0.7rem;">No formats</div>';
    }
    
    const qualities = ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p', '4320p'];
    const selector = [];
    
    for (const q of qualities) {
        let foundFormat = item.formats.find(f => f.label.includes(q));
        if (foundFormat) {
            const isPremium = isQualityPremium(foundFormat.label);
            const isSelected = item.selectedFormat?.format_id === foundFormat.format_id;
            selector.push(`
                <button class="batch-quality-btn ${isSelected ? 'active' : ''} ${isPremium && !isPremium ? 'premium-locked' : ''}"
                        onclick="updateBatchItemQuality(${item.id}, ${JSON.stringify(foundFormat).replace(/"/g, '&quot;')})">
                    ${foundFormat.label} ${isPremium ? '👑' : ''}
                </button>
            `);
        }
    }
    
    return `<div class="batch-quality-selector">${selector.join('')}</div>`;
}

// Render batch list
function renderBatchList() {
    if (!batchList) return;
    
    if (batchQueue.length === 0) {
        batchList.innerHTML = `
            <div class="batch-empty">
                <div class="batch-empty-icon">📦</div>
                <div>No videos in batch queue</div>
                <div style="font-size: 0.7rem; color: #555;">Add video URLs above to start batch download</div>
            </div>
        `;
        return;
    }
    
    batchList.innerHTML = batchQueue.map(item => `
        <div class="batch-item-card" data-id="${item.id}">
            <div class="batch-item-header">
                <img class="batch-item-thumb" src="${item.thumbnail || 'https://via.placeholder.com/60x40'}" onerror="this.src='https://via.placeholder.com/60x40'">
                <div class="batch-item-info">
                    <div class="batch-item-title">${escapeHtml(item.title.substring(0, 50))}</div>
                    <div class="batch-item-meta">⏱️ ${item.duration || '--:--'} • ${item.status === 'completed' ? '✅ Downloaded' : (item.status === 'downloading' ? '⏳ Downloading...' : (item.status === 'failed' ? '❌ Failed' : '⏸️ Pending'))}</div>
                </div>
                <button class="batch-item-remove" onclick="removeBatchItem(${item.id})" title="Remove">✖</button>
            </div>
            <div class="batch-item-quality">
                <div class="batch-quality-label">Select Quality:</div>
                ${renderBatchQualitySelector(item)}
            </div>
            ${item.status === 'downloading' ? `
                <div class="batch-item-progress">
                    <div class="batch-progress-bar">
                        <div class="batch-progress-fill" style="width: ${item.progress}%"></div>
                    </div>
                    <div class="batch-progress-text">${item.progress}%</div>
                </div>
            ` : ''}
            ${item.status === 'failed' ? `<div class="batch-item-error">${item.error || 'Download failed'}</div>` : ''}
        </div>
    `).join('');
}

// Update batch statistics
function updateBatchStats() {
    if (!batchProgress) return;
    
    const total = batchQueue.length;
    const completed = batchQueue.filter(i => i.status === 'completed').length;
    const failed = batchQueue.filter(i => i.status === 'failed').length;
    const downloading = batchQueue.filter(i => i.status === 'downloading').length;
    
    const percent = total > 0 ? (completed / total) * 100 : 0;
    batchProgress.style.width = `${percent}%`;
    
    if (batchStatus) {
        if (isBatchDownloading) {
            batchStatus.innerHTML = `
                <span>📥 Downloading: ${completed}/${total} completed</span>
                <span>⏳ Active: ${downloading} • ❌ Failed: ${failed}</span>
            `;
        } else if (completed === total && total > 0) {
            batchStatus.innerHTML = '<span style="color: #00ff44;">✅ All downloads completed!</span>';
        } else if (!isBatchDownloading && total > 0 && completed < total) {
            batchStatus.innerHTML = '<span>⏸️ Batch paused. Click "Resume" to continue.</span>';
        } else {
            batchStatus.innerHTML = `<span>📦 ${total} videos in queue • ${completed} completed</span>`;
        }
    }
    
    if (batchDownloadBtn) {
        const hasPending = batchQueue.some(i => i.status === 'pending' || i.status === 'paused');
        batchDownloadBtn.disabled = isBatchDownloading || (!hasPending && batchQueue.length > 0 && completed === total);
    }
}

// Download single batch item
async function downloadBatchItem(item) {
    if (!item.selectedFormat) {
        item.status = 'failed';
        item.error = 'No quality selected';
        renderBatchList();
        updateBatchStats();
        return false;
    }
    
    if (isQualityPremium(item.selectedFormat.label) && !isPremium) {
        item.status = 'failed';
        item.error = 'Premium required for this quality';
        renderBatchList();
        updateBatchStats();
        return false;
    }
    
    item.status = 'downloading';
    item.progress = 0;
    renderBatchList();
    updateBatchStats();
    
    const progressInterval = setInterval(() => {
        if (item.status === 'downloading' && item.progress < 90) {
            item.progress += 10;
            renderBatchList();
        }
    }, 300);
    
    try {
        const response = await fetch('/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: item.url,
                format_id: item.selectedFormat.format_id,
                title_hint: item.title
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
        a.download = `${item.title.substring(0, 50)}.${item.selectedFormat.ext || 'mp4'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        clearInterval(progressInterval);
        item.status = 'completed';
        item.progress = 100;
        renderBatchList();
        
        addToHistory(item.title, item.thumbnail, item.selectedFormat.label);
        return true;
        
    } catch (error) {
        clearInterval(progressInterval);
        item.status = 'failed';
        item.error = error.message;
        renderBatchList();
        return false;
    }
}

// Start batch download
async function startBatchDownload() {
    if (!isPremium) {
        showPremiumRequired('Batch download');
        return;
    }
    
    if (isBatchDownloading) {
        showToast('Batch download already in progress', true);
        return;
    }
    
    const pendingItems = batchQueue.filter(i => i.status === 'pending' || i.status === 'paused');
    if (pendingItems.length === 0) {
        showToast('No pending videos to download', true);
        return;
    }
    
    const missingQuality = batchQueue.filter(i => i.status === 'pending' && !i.selectedFormat);
    if (missingQuality.length > 0) {
        showToast(`Please select quality for ${missingQuality.length} video(s)`, true);
        return;
    }
    
    isBatchDownloading = true;
    updateBatchStats();
    if (batchPauseBtn) batchPauseBtn.textContent = '⏸️ Pause';
    
    showToast(`Starting batch download of ${pendingItems.length} videos...`, false);
    
    for (let i = 0; i < batchQueue.length; i++) {
        const item = batchQueue[i];
        if (item.status === 'pending' || item.status === 'paused') {
            if (!isBatchDownloading) {
                item.status = 'paused';
                renderBatchList();
                break;
            }
            await downloadBatchItem(item);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    isBatchDownloading = false;
    if (batchPauseBtn) batchPauseBtn.textContent = '▶️ Resume';
    updateBatchStats();
    
    const completed = batchQueue.filter(i => i.status === 'completed').length;
    const failed = batchQueue.filter(i => i.status === 'failed').length;
    showToast(`✅ Batch complete: ${completed} downloaded, ${failed} failed`);
}

// Pause batch download
function pauseBatchDownload() {
    if (!isBatchDownloading) {
        showToast('No active batch download to pause', true);
        return;
    }
    isBatchDownloading = false;
    if (batchPauseBtn) batchPauseBtn.textContent = '▶️ Resume';
    showToast('⏸️ Batch download paused');
    updateBatchStats();
}

// Resume batch download
function resumeBatchDownload() {
    if (isBatchDownloading) {
        showToast('Batch download already running', true);
        return;
    }
    startBatchDownload();
}

// Clear batch queue
function clearBatchQueue() {
    if (isBatchDownloading) {
        showToast('Cannot clear while downloading', true);
        return;
    }
    batchQueue = [];
    renderBatchList();
    updateBatchStats();
    showToast('Batch queue cleared');
}

// ============= VIDEO ANALYSIS & DOWNLOAD =============

// Analyze video
async function analyzeVideo() {
    const url = urlInput?.value.trim();
    if (!url) {
        showToast('Please paste a video URL', true);
        return;
    }
    
    if (skeleton) skeleton.classList.add('active');
    if (videoPreview) videoPreview.style.display = 'none';
    if (qualitySection) qualitySection.style.display = 'none';
    if (downloadSection) downloadSection.style.display = 'none';
    
    if (analyzeBtn) analyzeBtn.classList.add('loading');
    if (analyzeBtn) analyzeBtn.disabled = true;
    
    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to analyze video');
        }
        
        const data = await response.json();
        currentVideoData = data;
        
        if (thumbnail) thumbnail.src = data.thumbnail || 'https://via.placeholder.com/160x90';
        if (title) title.textContent = data.title || 'Unknown Title';
        if (platform) platform.textContent = data.platform || 'Unknown';
        if (duration) duration.textContent = data.duration || '--:--';
        if (views) views.textContent = data.view_count ? `${data.view_count.toLocaleString()} views` : '— views';
        
        renderQualities(data.formats || []);
        
        if (skeleton) skeleton.classList.remove('active');
        if (videoPreview) videoPreview.style.display = 'flex';
        if (qualitySection) qualitySection.style.display = 'block';
        if (downloadSection) downloadSection.style.display = 'block';
        
        showToast('✓ Video analyzed successfully!');
        
    } catch (error) {
        if (skeleton) skeleton.classList.remove('active');
        showToast(error.message, true);
    } finally {
        if (analyzeBtn) analyzeBtn.classList.remove('loading');
        if (analyzeBtn) analyzeBtn.disabled = false;
    }
}

// Download single video
async function startDownload() {
    if (!currentVideoData || !selectedFormat) {
        showToast('Please select a quality first', true);
        return;
    }
    
    if (isQualityPremium(selectedFormat.label) && !isPremium) {
        showPremiumRequired(selectedFormat.label);
        return;
    }
    
    if (downloadBtn) downloadBtn.disabled = true;
    if (progressContainer) progressContainer.classList.add('active');
    
    let progress = 0;
    const interval = setInterval(() => {
        if (progress < 90) {
            progress += 10;
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressPercent) progressPercent.textContent = `${progress}%`;
        }
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
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        clearInterval(interval);
        if (progressFill) progressFill.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressLabel) progressLabel.textContent = 'Complete!';
        
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
    } finally {
        if (downloadBtn) downloadBtn.disabled = false;
    }
}

// ============= HISTORY FUNCTIONS =============

// Add to history
function addToHistory(videoTitle, thumbnailUrl, quality) {
    const historyItem = {
        id: Date.now(),
        title: videoTitle.substring(0, 40),
        thumbnail: thumbnailUrl,
        quality: quality,
        timestamp: new Date().toLocaleString()
    };
    downloadHistory.unshift(historyItem);
    if (downloadHistory.length > 10) downloadHistory.pop();
    localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory));
    renderHistory();
}

// Render history
function renderHistory() {
    if (!historyList) return;
    if (downloadHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No downloads yet</div>';
        return;
    }
    historyList.innerHTML = downloadHistory.map(item => `
        <div class="history-item">
            <img src="${item.thumbnail || 'https://via.placeholder.com/70x50'}" onerror="this.src='https://via.placeholder.com/70x50'">
            <div class="history-info">
                <div class="history-title">${escapeHtml(item.title)}</div>
                <div class="history-meta">${item.timestamp}</div>
            </div>
            <div class="history-quality ${PREMIUM_QUALITIES.some(q => item.quality.includes(q)) ? 'premium-quality' : ''}">${item.quality}</div>
        </div>
    `).join('');
}

function clearHistory() {
    downloadHistory = [];
    localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory));
    renderHistory();
    showToast('History cleared');
}

// ============= PREMIUM SUBSCRIPTION =============

function subscribePremium(plan = 'month') {
    showToast('Processing payment...', false);
    setTimeout(() => {
        isPremium = true;
        localStorage.setItem('isPremium', 'true');
        updatePremiumBadge();
        if (premiumModal) premiumModal.classList.remove('active');
        showToast('🎉 Welcome to Premium! You now have access to 2K, 4K, 5K, 8K & batch downloads!', false);
        if (currentVideoData && currentVideoData.formats) {
            renderQualities(currentVideoData.formats);
        }
    }, 1500);
}

// ============= UTILITY FUNCTIONS =============

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============= EVENT LISTENERS =============

if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (urlInput) urlInput.value = text;
            showToast('Link pasted!');
        } catch (err) {
            showToast('Could not paste from clipboard', true);
        }
    });
}

if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeVideo);
if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);
if (premiumBtn) premiumBtn.addEventListener('click', () => premiumModal?.classList.add('active'));
if (closeModalBtn) closeModalBtn.addEventListener('click', () => premiumModal?.classList.remove('active'));
if (downloadBtn) downloadBtn.addEventListener('click', startDownload);
if (subscribeMonthBtn) subscribeMonthBtn.addEventListener('click', () => subscribePremium('month'));
if (subscribeYearBtn) subscribeYearBtn.addEventListener('click', () => subscribePremium('year'));
if (batchAddBtn) batchAddBtn.addEventListener('click', addBatchUrl);
if (batchDownloadBtn) batchDownloadBtn.addEventListener('click', startBatchDownload);
if (batchPauseBtn) batchPauseBtn.addEventListener('click', () => {
    if (isBatchDownloading) pauseBatchDownload();
    else resumeBatchDownload();
});
if (clearBatchBtn) clearBatchBtn.addEventListener('click', clearBatchQueue);

// Close modal on outside click
if (premiumModal) {
    premiumModal.addEventListener('click', (e) => {
        if (e.target === premiumModal) premiumModal.classList.remove('active');
    });
}

if (urlInput) {
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') analyzeVideo();
    });
}

// ============= INITIALIZATION =============

// Initialize animated name
initAnimatedName();

// Initialize premium badge
updatePremiumBadge();

// Initialize history
renderHistory();

// Expose functions globally
window.removeBatchItem = removeBatchItem;
window.updateBatchItemQuality = updateBatchItemQuality;
window.subscribePremium = subscribePremium;
