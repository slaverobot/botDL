// ============= STORE DATA =============
let searchResults = [];
let currentAudio = null;
let currentPlayingBtn = null;

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
const toastContainer = document.getElementById('toastContainer');

// ==========================================================================
// ============= LETTER JUMPING ANIMATION ===================================
// ==========================================================================
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

// ==========================================================================
// ============= TOAST ======================================================
// ==========================================================================
function showToast(message, type = 'info') {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: 'check-circle-fill',
        error: 'exclamation-triangle-fill',
        info: 'info-circle-fill'
    };

    toast.innerHTML = `
        <i class="bi bi-${iconMap[type] || 'info-circle-fill'}"></i>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================================================
// ============= THEME ======================================================
// ==========================================================================
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark'
                ? 'bi bi-moon-stars-fill'
                : 'bi bi-sun-fill';
        }
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

// ==========================================================================
// ============= STATE HELPERS ==============================================
// ==========================================================================
function showSkeleton() {
    if (skeletonGrid) skeletonGrid.classList.add('active');
    if (resultsGrid) resultsGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (searchBtn) {
        searchBtn.classList.add('loading');
        searchBtn.disabled = true;
    }
}

function hideSkeleton() {
    if (skeletonGrid) skeletonGrid.classList.remove('active');
    if (searchBtn) {
        searchBtn.classList.remove('loading');
        searchBtn.disabled = false;
    }
}

function showEmpty() {
    if (skeletonGrid) skeletonGrid.classList.remove('active');
    if (resultsGrid) resultsGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    if (errorState) errorState.style.display = 'none';
}

function showError(message) {
    if (skeletonGrid) skeletonGrid.classList.remove('active');
    if (resultsGrid) resultsGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'flex';
    if (errorMessage) errorMessage.textContent = message;
}

// ==========================================================================
// ============= SEARCH FUNCTION (Jamendo pekee) ============================
// ==========================================================================
async function searchMusic(query) {
    if (!query || query.trim() === '') {
        showToast('Please enter an artist or song name', 'error');
        return;
    }

    showSkeleton();

    try {
        const response = await fetch(
            `/api/jamendo/search?q=${encodeURIComponent(query.trim())}&limit=20`
        );
        const data = await response.json();

        hideSkeleton();

        if (!response.ok || data.error) {
            showError(data.error || 'Search failed');
            showToast(data.error || 'Search failed', 'error');
            return;
        }

        if (!data.tracks || data.tracks.length === 0) {
            showEmpty();
            showToast(`No results found for "${query}"`, 'error');
            return;
        }

        searchResults = data.tracks;
        displayTracks(data.tracks);
        showToast(`Found ${data.tracks.length} tracks`, 'success');

    } catch (error) {
        hideSkeleton();
        console.error('Search error:', error);
        showError('Something went wrong. Please try again.');
        showToast('Connection error. Try again.', 'error');
    }
}

// ==========================================================================
// ============= DISPLAY TRACKS =============================================
// ==========================================================================
function displayTracks(tracks) {
    if (!resultsGrid) return;

    resultsGrid.innerHTML = '';
    resultsGrid.style.display = 'grid';

    tracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'song-card';

        const duration = formatDuration(track.duration);
        const image = track.image || 'https://via.placeholder.com/300x300/141A2B/4A8BFF?text=🎵';

        card.innerHTML = `
            <div class="song-thumbnail-wrapper">
                <img src="${image}"
                     alt="${escapeHtml(track.title)}"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/300x300/141A2B/4A8BFF?text=🎵'">
                <span class="song-duration">${duration}</span>
            </div>
            <div class="song-info">
                <h3 class="song-title">${escapeHtml(track.title)}</h3>
                <p class="song-artist">
                    <i class="bi bi-person"></i>
                    ${escapeHtml(track.artist)}
                </p>
                <div class="song-actions">
                    <button class="preview-btn" data-audio="${escapeHtml(track.audio || '')}">
                        <i class="bi bi-play-fill"></i> Preview
                    </button>
                    <button class="download-btn"
                            data-id="${track.id}"
                            data-title="${escapeHtml(track.title)}"
                            data-artist="${escapeHtml(track.artist)}">
                        <i class="bi bi-download"></i> Download
                    </button>
                </div>
            </div>
        `;

        resultsGrid.appendChild(card);
    });

    // Attach event listeners
    document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', handlePreview);
    });

    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', handleDownload);
    });
}

// ==========================================================================
// ============= PREVIEW HANDLER ============================================
// ==========================================================================
function handlePreview(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const audioUrl = btn.dataset.audio;

    if (!audioUrl) {
        showToast('Preview not available for this track', 'error');
        return;
    }

    // Kama ni track hii hii inayocheza - pause
    if (currentAudio && currentPlayingBtn === btn) {
        currentAudio.pause();
        currentAudio = null;
        btn.classList.remove('playing');
        btn.innerHTML = '<i class="bi bi-play-fill"></i> Preview';
        currentPlayingBtn = null;
        return;
    }

    // Pause track nyingine kama ipo
    if (currentAudio) {
        currentAudio.pause();
        if (currentPlayingBtn) {
            currentPlayingBtn.classList.remove('playing');
            currentPlayingBtn.innerHTML = '<i class="bi bi-play-fill"></i> Preview';
        }
    }

    // Anza preview mpya
    currentAudio = new Audio(audioUrl);
    currentPlayingBtn = btn;

    btn.classList.add('playing');
    btn.innerHTML = '<i class="bi bi-pause-fill"></i> Playing';

    currentAudio.play().catch(err => {
        console.error('Play error:', err);
        showToast('Cannot play preview', 'error');
        btn.classList.remove('playing');
        btn.innerHTML = '<i class="bi bi-play-fill"></i> Preview';
        currentAudio = null;
        currentPlayingBtn = null;
    });

    currentAudio.addEventListener('ended', () => {
        btn.classList.remove('playing');
        btn.innerHTML = '<i class="bi bi-play-fill"></i> Preview';
        currentAudio = null;
        currentPlayingBtn = null;
    });
}

// ==========================================================================
// ============= DOWNLOAD HANDLER (Jamendo full song) =======================
// ==========================================================================
function handleDownload(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const trackId = btn.dataset.id;
    const title = btn.dataset.title;

    if (!trackId) {
        showToast('No track selected', 'error');
        return;
    }

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Downloading...';

    showToast(`Downloading "${title}"...`, 'info');

    // Trigger download - browser itaanza kupakua
    const downloadUrl = `/api/jamendo/download?id=${trackId}`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${sanitizeFilename(title)}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Reset button baada ya sekunde 3
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Done';
        showToast(`"${title}" download started!`, 'success');

        setTimeout(() => {
            btn.innerHTML = originalHtml;
        }, 2000);
    }, 2000);
}

// ==========================================================================
// ============= HELPERS ====================================================
// ==========================================================================
function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return '--:--';
    const totalSeconds = Math.floor(Number(seconds));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return map[m];
    });
}

function sanitizeFilename(name) {
    if (!name) return 'audio';
    return name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 80);
}

// ==========================================================================
// ============= EVENT LISTENERS ============================================
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Search button
    searchBtn?.addEventListener('click', () => {
        searchMusic(searchInput?.value || '');
    });

    // Enter key
    searchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchMusic(searchInput.value);
        }
    });

    // Clear button visibility
    searchInput?.addEventListener('input', () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value.trim() ? 'flex' : 'none';
        }
    });

    // Clear button
    clearBtn?.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        if (clearBtn) clearBtn.style.display = 'none';
        if (resultsGrid) resultsGrid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
    });

    // Quick tags
    document.querySelectorAll('.quick-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const query = tag.dataset.query;
            if (searchInput) searchInput.value = query;
            if (clearBtn) clearBtn.style.display = 'flex';
            searchMusic(query);
        });
    });

    // Initialize animated name
    initAnimatedName();

    // Navbar scroll effect
    handleNavbarScroll();
});

// ==========================================================================
// ============= NAVBAR SCROLL ==============================================
// ==========================================================================
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

// ==========================================================================
// ============= PAGE LOAD FADE =============================================
// ==========================================================================
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.5s ease';
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
});

// ==========================================================================
// ============= GLOBAL EXPORTS =============================================
// ==========================================================================
window.searchMusic = searchMusic;
