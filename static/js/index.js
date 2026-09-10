// ============= STORE DATA =============
let currentVideoData = null;
let selectedFormat = null;
let downloadHistory = JSON.parse(localStorage.getItem('downloadHistory') || '[]');

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
const themeToggle = document.getElementById('themeToggle');

// ============= MP3 CONVERTER DOM ELEMENTS =============
const converterUrlInput = document.getElementById('converterUrlInput');
const converterPasteBtn = document.getElementById('converterPasteBtn');
const convertBtn = document.getElementById('convertBtn');
const converterResult = document.getElementById('converterResult');
const converterThumbnail = document.getElementById('converterThumbnail');
const converterTitle = document.getElementById('converterTitle');
const converterDuration = document.getElementById('converterDuration');
const converterSize = document.getElementById('converterSize');
const downloadMp3Btn = document.getElementById('downloadMp3Btn');
const mp3ProgressContainer = document.getElementById('mp3ProgressContainer');
const mp3ProgressFill = document.getElementById('mp3ProgressFill');
const mp3ProgressPercent = document.getElementById('mp3ProgressPercent');

let currentMp3Data = null;
let selectedBitrate = '128';

// ============= LETTER JUMPING ANIMATION (SMOOTH & PERFORMANT) =============
const fullName = 'Mohamed Watitu';
let currentLetterIndex = 0;
let animationInterval = null;
const animatedNameElement = document.getElementById('animatedName');

const jumpColors = ['#4A8BFF', '#4DD0E1', '#4ADE80', '#4A8BFF', '#4DD0E1'];

function jumpLetter(span, color) {
    if (!span) return;
    // Improve performance
    span.style.willChange = 'transform, color';
    span.classList.add('jumping');
    span.style.color = color;
    
    setTimeout(() => {
        if (span) {
            span.classList.remove('jumping');
            span.style.color = '';
            setTimeout(() => {
                span.style.willChange = 'auto';
            }, 100);
        }
    }, 400);
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
    
    // Prevent layout shift
    animatedNameElement.style.display = 'inline-flex';
    animatedNameElement.style.alignItems = 'center';
    animatedNameElement.style.gap = '1px';
    animatedNameElement.style.position = 'relative';
    animatedNameElement.style.flexShrink = '0';
    
    animatedNameElement.innerHTML = '';
    fullName.split('').forEach(letter => {
        const span = document.createElement('span');
        span.textContent = letter;
        span.className = 'letter-jump';
        span.style.display = 'inline-block';
        span.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.35s ease';
        span.style.backfaceVisibility = 'hidden';
        span.style.webkitBackfaceVisibility = 'hidden';
        if (letter === ' ') {
            span.style.width = '0.3rem';
            span.style.minWidth = '0.3rem';
        }
        animatedNameElement.appendChild(span);
    });
    
    if (animationInterval) clearInterval(animationInterval);
    animationInterval = setInterval(jumpNextLetter, 1200);
}

// ============= TOAST FUNCTIONS =============
function showToast(message, isError = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`.trim();
    toast.innerHTML = `<span>${isError ? '⚠️ ' : '✅ '}${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ============= RENDER QUALITIES =============
function renderQualities(formats) {
    if (!qualityGrid) return;
    qualityGrid.innerHTML = '';
    selectedFormat = null;

    const qualities = ['480p', '720p', '1080p', '2K', '4K', '8K'];

    qualities.forEach(quality => {
        const found = formats.find(f => f.label && f.label.includes(quality));
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
        }
        qualityGrid.appendChild(div);
    });

    setTimeout(() => {
        const options = qualityGrid.querySelectorAll('.quality-option');
        options.forEach(opt => {
            if (opt.textContent.includes('1080p') && !opt.style.cursor.includes('not-allowed')) {
                opt.click();
            }
        });
    }, 100);
}

// ============= THEME =============
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
        themeToggle.innerHTML = theme === 'dark'
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    }
}

const savedTheme = localStorage.getItem('botdl-theme') || 'dark';
applyTheme(savedTheme);

themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('botdl-theme', next);
});

// ============= ANALYZE VIDEO =============
async function analyzeVideo() {
    const url = urlInput?.value.trim();
    if (!url) {
        showToast('Please paste a video URL', true);
        if (urlInput) {
            urlInput.style.borderColor = '#4A8BFF';
            setTimeout(() => urlInput.style.borderColor = '', 2000);
        }
        return;
    }

    if (urlInput) urlInput.style.borderColor = '';
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

        if (thumbnail) thumbnail.src = data.thumbnail || 'https://via.placeholder.com/160x90';
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
        historyList.innerHTML = '<div class="empty-history">No downloads yet. Start by pasting a video link above.</div>';
        return;
    }
    historyList.innerHTML = downloadHistory.map(item => `
        <div class="history-item">
            <img src="${item.thumbnail || 'https://via.placeholder.com/60x40'}" onerror="this.src='https://via.placeholder.com/60x40'">
            <div class="history-info">
                <div class="history-title">${escapeHtml(item.title)}</div>
                <div class="history-meta">${item.timestamp}</div>
            </div>
            <div class="history-quality">${escapeHtml(item.quality || '')}</div>
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
    return str.replace(/[&<>]/g, m => (m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;')));
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
            if (urlInput) {
                urlInput.style.borderColor = '#4ADE80';
                setTimeout(() => urlInput.style.borderColor = '', 1000);
            }
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

// ============= INTERSECTION OBSERVER =============
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
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease';
    observer.observe(el);
});

// ============= PAGE LOAD =============
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.5s ease';
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
});

// ============= FLOATING NAVBAR =============
function handleNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
}

let scrollTimeout;
window.addEventListener('scroll', () => {
    if (scrollTimeout) return;
    scrollTimeout = requestAnimationFrame(() => {
        handleNavbarScroll();
        scrollTimeout = null;
    });
}, { passive: true });

handleNavbarScroll();

// ============= MP3 CONVERTER =============

// Quality selection
document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        selectedBitrate = this.dataset.bitrate;
    });
});

// Paste button for converter
if (converterPasteBtn) {
    converterPasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (converterUrlInput) converterUrlInput.value = text;
            showToast('Link pasted! Ready to extract MP3', false);
        } catch {
            showToast('Cannot paste. Please copy the link first', true);
        }
    });
}

// Convert to MP3
if (convertBtn) {
    convertBtn.addEventListener('click', async () => {
        const url = converterUrlInput?.value.trim();
        if (!url) {
            showToast('Please paste a video URL', true);
            return;
        }

        convertBtn.classList.add('loading');
        convertBtn.disabled = true;
        converterResult.style.display = 'none';
        mp3ProgressContainer.style.display = 'none';

        try {
            const analyzeResponse = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!analyzeResponse.ok) {
                const error = await analyzeResponse.json();
                throw new Error(error.error || 'Failed to analyze video');
            }

            const data = await analyzeResponse.json();
            currentMp3Data = data;

            converterThumbnail.src = data.thumbnail || 'https://via.placeholder.com/80x50';
            converterTitle.textContent = data.title || 'Unknown Title';
            converterDuration.textContent = `⏱ ${data.duration || '--:--'}`;

            const durationMinutes = parseInt(data.duration) / 60 || 1;
            const sizePerMinute = selectedBitrate === 'lossless' ? 10 : selectedBitrate / 128 * 0.8;
            const estimatedSize = (durationMinutes * sizePerMinute).toFixed(1);
            converterSize.textContent = `📦 ~${estimatedSize} MB`;

            converterResult.style.display = 'block';
            showToast('✓ Video analyzed! Ready to extract MP3', false);

        } catch (error) {
            showToast(error.message, true);
        } finally {
            convertBtn.classList.remove('loading');
            convertBtn.disabled = false;
        }
    });
}

// Download MP3 with progress
if (downloadMp3Btn) {
    downloadMp3Btn.addEventListener('click', async () => {
        if (!currentMp3Data) {
            showToast('Please extract MP3 first', true);
            return;
        }

        downloadMp3Btn.disabled = true;
        mp3ProgressContainer.style.display = 'block';
        mp3ProgressFill.style.width = '0%';
        mp3ProgressPercent.textContent = '0%';

        let progress = 0;
        const interval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 8;
                if (progress > 90) progress = 90;
                mp3ProgressFill.style.width = `${progress}%`;
                mp3ProgressPercent.textContent = `${Math.floor(progress)}%`;
            }
        }, 300);

        try {
            const response = await fetch('/convert-to-mp3', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: currentMp3Data.url,
                    bitrate: selectedBitrate,
                    title_hint: currentMp3Data.title
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'MP3 conversion failed');
            }

            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${currentMp3Data.title.substring(0, 50)}.mp3`;
            a.click();
            URL.revokeObjectURL(downloadUrl);

            clearInterval(interval);
            mp3ProgressFill.style.width = '100%';
            mp3ProgressPercent.textContent = '100%';
            showToast('✓ MP3 downloaded successfully!', false);

            setTimeout(() => {
                mp3ProgressContainer.style.display = 'none';
                mp3ProgressFill.style.width = '0%';
                mp3ProgressPercent.textContent = '0%';
            }, 2000);

        } catch (error) {
            clearInterval(interval);
            showToast(error.message, true);
            mp3ProgressContainer.style.display = 'none';
        } finally {
            downloadMp3Btn.disabled = false;
        }
    });
}

// Enter key for converter input
if (converterUrlInput) {
    converterUrlInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') convertBtn?.click();
    });
}

// ============= INITIALIZATION =============
initAnimatedName();
renderHistory();

// ============= FADE IN/OUT ON SCROLL - SMOOTH SECTION TRANSITIONS =============

// Select all sections that should animate
const fadeSections = document.querySelectorAll(
    '.hero, .features, .platforms, .main-content, .converter-section, .footer, ' +
    '.feature-card, .platform-card, .analysis-card, .converter-container, ' +
    '.dashboard, .welcome-banner, .quality-section, .download-section'
);

// Options for Intersection Observer
const fadeOptions = {
    threshold: 0.12, // Trigger when 12% of element is visible
    rootMargin: '0px 0px -30px 0px' // Slightly offset for smoother feel
};

// Create observer for fade sections
const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const el = entry.target;
        
        if (entry.isIntersecting) {
            // Element is coming into view - fade in
            el.classList.remove('leaving');
            el.classList.add('visible');
            
            // Add stagger effect if class exists
            if (el.classList.contains('stagger-children')) {
                el.classList.add('visible');
            }
        } else {
            // Element is leaving viewport - fade out
            el.classList.remove('visible');
            el.classList.add('leaving');
            
            // Remove stagger visibility
            if (el.classList.contains('stagger-children')) {
                el.classList.remove('visible');
            }
        }
    });
}, fadeOptions);

// Apply fade-section class to each element and observe
fadeSections.forEach((el, index) => {
    // Skip if already has fade class
    if (!el.classList.contains('fade-section') && 
        !el.classList.contains('fade-left') && 
        !el.classList.contains('fade-right') && 
        !el.classList.contains('fade-up') && 
        !el.classList.contains('fade-scale')) {
        
        // Add default fade class
        el.classList.add('fade-section');
        
        // Add slight delay for staggered effect based on index
        if (index % 3 === 0) el.classList.add('delay-1');
        else if (index % 3 === 1) el.classList.add('delay-2');
        else if (index % 3 === 2) el.classList.add('delay-3');
    }
    
    // Observe the element
    fadeObserver.observe(el);
});

// ============= STAGGER CHILDREN FOR CARDS/GRIDS =============

// Add stagger effect to grid containers
document.querySelectorAll('.features-grid, .platforms-grid, .quality-grid, .history-list').forEach(grid => {
    grid.classList.add('stagger-children');
    fadeObserver.observe(grid);
});

// ============= SPECIAL HANDLING FOR HERO SECTION =============
const heroSection = document.querySelector('.hero');
if (heroSection) {
    // Hero should be visible on load with special animation
    heroSection.classList.add('fade-section', 'fade-scale');
    setTimeout(() => {
        heroSection.classList.add('visible');
    }, 200);
}

// ============= URL CONTAINER FADE =============
const urlContainer = document.querySelector('.url-container');
if (urlContainer) {
    urlContainer.classList.add('fade-section', 'fade-up', 'delay-2');
    setTimeout(() => {
        urlContainer.classList.add('visible');
    }, 400);
}

// ============= RE-OBSERVE AFTER DYNAMIC CONTENT LOAD =============
// When analyzing video, re-observe new elements
const originalAnalyze = window.analyzeVideo;
if (originalAnalyze) {
    window.analyzeVideo = async function() {
        await originalAnalyze.apply(this, arguments);
        
        // After video analysis, observe new elements
        setTimeout(() => {
            document.querySelectorAll('.analysis-card, .quality-section, .download-section').forEach(el => {
                if (!el.classList.contains('fade-section')) {
                    el.classList.add('fade-section', 'fade-up');
                }
                fadeObserver.observe(el);
                
                // Trigger visibility after a moment
                setTimeout(() => {
                    el.classList.add('visible');
                }, 300);
            });
        }, 500);
    };
}

// ============= RE-OBSERVE AFTER MP3 CONVERSION =============
const originalConvert = document.querySelector('#convertBtn')?.click;
if (originalConvert) {
    // Monkey patch convert button click
    const convertBtn = document.querySelector('#convertBtn');
    if (convertBtn) {
        convertBtn.addEventListener('click', function(e) {
            // After conversion result appears, observe it
            setTimeout(() => {
                const result = document.querySelector('.converter-result');
                if (result) {
                    result.classList.add('fade-section', 'fade-up');
                    fadeObserver.observe(result);
                    setTimeout(() => result.classList.add('visible'), 300);
                }
            }, 1000);
        });
    }
}

// Expose functions globally
window.analyzeVideo = analyzeVideo;
window.startDownload = startDownload;
window.clearHistory = clearHistory;
