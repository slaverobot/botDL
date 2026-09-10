// ============= STORE DATA =============
let searchResults = [];
let currentAudio = null;
let currentPlayingCard = null;

// ============= DOM ELEMENTS =============
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const resultsGrid = document.getElementById('resultsGrid');
const skeletonGrid = document.getElementById('skeletonGrid');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const themeToggle = document.getElementById('themeToggle');

// ============= LETTER JUMPING ANIMATION =============
const fullName = 'Mohamed Watitu';
let currentLetterIndex = 0;
let animationInterval = null;
const animatedNameElement = document.getElementById('animatedName');
const jumpColors = ['#4A8BFF', '#4DD0E1', '#4ADE80', '#4A8BFF', '#4DD0E1'];

function jumpLetter(span, color) {
    if (!span) return;
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
    
    animatedNameElement.style.display = 'inline-flex';
    animatedNameElement.style.alignItems = 'center';
    animatedNameElement.style.gap = '1px';
    animatedNameElement.style.flexShrink = '0';
    
    animatedNameElement.innerHTML = '';
    fullName.split('').forEach(letter => {
        const span = document.createElement('span');
        span.textContent = letter;
        span.className = 'letter-jump';
        span.style.display = 'inline-block';
        span.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.35s ease';
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

// ============= SEARCH FUNCTION (Using Backend) =============
async function searchMusic(query) {
    if (!query || query.trim() === '') {
        showToast('Please enter an artist or song name', true);
        return;
    }

    if (skeletonGrid) skeletonGrid.classList.add('active');
    if (resultsGrid) resultsGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (searchBtn) {
        searchBtn.classList.add('loading');
        searchBtn.disabled = true;
    }

    try {
        // Call backend search API
        const response = await fetch('/api/mp3/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query.trim() })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Search failed');
        }
        
        const data = await response.json();
        searchResults = data.results || [];
        
        if (skeletonGrid) skeletonGrid.classList.remove('active');
        
        if (searchResults.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            showToast('No results found for "' + query + '"', true);
        } else {
            renderResults(searchResults);
            if (resultsGrid) resultsGrid.style.display = 'grid';
            showToast(`Found ${searchResults.length} results`, false);
        }
        
    } catch (error) {
        if (skeletonGrid) skeletonGrid.classList.remove('active');
        if (errorState) {
            errorState.style.display = 'flex';
            if (errorMessage) errorMessage.textContent = error.message;
        }
        showToast(error.message, true);
    } finally {
        if (searchBtn) {
            searchBtn.classList.remove('loading');
            searchBtn.disabled = false;
        }
    }
}

// ============= RENDER RESULTS =============
function renderResults(results) {
    if (!resultsGrid) return;
    resultsGrid.innerHTML = '';
    
    results.forEach((song, index) => {
        const card = document.createElement('div');
        card.className = 'song-card';
        
        const artwork = song.artwork || 'https://via.placeholder.com/300x300/141A2B/4A8BFF?text=🎵';
        const title = song.title || 'Unknown Title';
        const artist = song.artist || 'Unknown Artist';
        const previewUrl = song.preview_url || '';
        const duration = formatDuration(song.duration_ms);
        
        card.innerHTML = `
            <div class="song-thumbnail-wrapper">
                <img src="${artwork}" alt="${escapeHtml(title)}" 
                     onerror="this.src='https://via.placeholder.com/300x300/141A2B/4A8BFF?text=🎵'">
                <span class="song-duration">${duration}</span>
            </div>
            <div class="song-info">
                <h3 class="song-title">${escapeHtml(title)}</h3>
                <p class="song-artist">
                    <i class="fas fa-user"></i>
                    ${escapeHtml(artist)}
                </p>
                <div class="song-actions">
                    <button class="preview-btn" data-preview="${previewUrl}">
                        <i class="fas fa-play"></i> Preview
                    </button>
                    <button class="download-btn" 
                            data-title="${escapeHtml(title)}" 
                            data-artist="${escapeHtml(artist)}">
                        <i class="fas fa-download"></i> MP3
                    </button>
                </div>
            </div>
        `;
        
        resultsGrid.appendChild(card);
    });
    
    // Add event listeners
    document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', handlePreview);
    });
    
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', handleDownload);
    });
}

// ============= FORMAT DURATION =============
function formatDuration(ms) {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ============= ESCAPE HTML =============
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[m];
    });
}

// ============= PREVIEW HANDLER =============
function handlePreview(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const previewUrl = btn.dataset.preview;
    
    if (!previewUrl) {
        showToast('Preview not available for this track', true);
        return;
    }
    
    if (currentAudio && currentPlayingCard === btn) {
        currentAudio.pause();
        currentAudio = null;
        btn.classList.remove('playing');
        btn.innerHTML = '<i class="fas fa-play"></i> Preview';
        currentPlayingCard = null;
        return;
    }
    
    if (currentAudio) {
        currentAudio.pause();
        if (currentPlayingCard) {
            currentPlayingCard.classList.remove('playing');
            currentPlayingCard.innerHTML = '<i class="fas fa-play"></i> Preview';
        }
    }
    
    currentAudio = new Audio(previewUrl);
    currentPlayingCard = btn;
    
    btn.classList.add('playing');
    btn.innerHTML = '<i class="fas fa-pause"></i> Playing';
    
    currentAudio.play().catch(err => {
        showToast('Cannot play preview', true);
        btn.classList.remove('playing');
        btn.innerHTML = '<i class="fas fa-play"></i> Preview';
        currentAudio = null;
        currentPlayingCard = null;
    });
    
    currentAudio.addEventListener('ended', () => {
        btn.classList.remove('playing');
        btn.innerHTML = '<i class="fas fa-play"></i> Preview';
        currentAudio = null;
        currentPlayingCard = null;
    });
}

// ============= DOWNLOAD HANDLER - FULL SONG =============
async function handleDownload(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const title = btn.dataset.title;
    const artist = btn.dataset.artist;
    
    if (!title) {
        showToast('No song selected', true);
        return;
    }
    
    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
    
    try {
        // Call backend to download FULL song
        const response = await fetch('/api/mp3/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                artist: artist
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
        a.download = `${sanitizeFilename(artist)} - ${sanitizeFilename(title)}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        
        showToast(`Downloaded: ${title}`, false);
        btn.innerHTML = '<i class="fas fa-check"></i> Done';
        
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }, 2000);
        
    } catch (error) {
        showToast(error.message || 'Download failed', true);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ============= SANITIZE FILENAME =============
function sanitizeFilename(name) {
    if (!name) return 'audio';
    return name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 80);
}

// ============= CLEAR SEARCH =============
if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        resultsGrid.style.display = 'none';
        emptyState.style.display = 'none';
        errorState.style.display = 'none';
        searchInput.focus();
    });
}

// ============= SEARCH INPUT EVENTS =============
if (searchInput) {
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim().length > 0) {
            clearBtn.style.display = 'flex';
        } else {
            clearBtn.style.display = 'none';
        }
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchMusic(searchInput.value.trim());
        }
    });
}

if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        searchMusic(searchInput.value.trim());
    });
}

// ============= QUICK TAGS =============
document.querySelectorAll('.quick-tag').forEach(tag => {
    tag.addEventListener('click', () => {
        const query = tag.dataset.query;
        if (searchInput) searchInput.value = query;
        if (clearBtn) clearBtn.style.display = 'flex';
        searchMusic(query);
    });
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

// ============= PAGE LOAD =============
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.5s ease';
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
});

// ============= INITIALIZATION =============
initAnimatedName();

window.searchMusic = searchMusic;
