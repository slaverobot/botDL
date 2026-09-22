// ==========================================================================
// ============= STATE ======================================================
// ==========================================================================
let currentAudio = null;

// ==========================================================================
// ============= DOM ELEMENTS ==============================================
// ==========================================================================
const movieInput = document.getElementById('movieInput');
const movieClearBtn = document.getElementById('movieClearBtn');
const movieSearchBtn = document.getElementById('movieSearchBtn');
const movieGrid = document.getElementById('movieGrid');
const movieSkeletonGrid = document.getElementById('movieSkeletonGrid');
const movieEmptyState = document.getElementById('movieEmptyState');
const movieErrorState = document.getElementById('movieErrorState');
const movieErrorMessage = document.getElementById('movieErrorMessage');
const themeToggle = document.getElementById('themeToggle');
const toastContainer = document.getElementById('toastContainer');

// Modal elements
const movieModal = document.getElementById('movieModal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

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

applyTheme(localStorage.getItem('botdl-theme') || 'dark');

themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('botdl-theme', next);
});

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
// ============= HELPERS ====================================================
// ==========================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[m]);
}

function sanitizeFilename(name) {
    if (!name) return 'movie';
    return name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 80);
}

function formatRuntime(minutes) {
    if (!minutes) return 'N/A';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ==========================================================================
// ============= SKELETON / STATES ==========================================
// ==========================================================================
function showMovieSkeleton() {
    if (movieSkeletonGrid) movieSkeletonGrid.style.display = 'grid';
    if (movieGrid) movieGrid.style.display = 'none';
    if (movieEmptyState) movieEmptyState.style.display = 'none';
    if (movieErrorState) movieErrorState.style.display = 'none';
}

function hideMovieSkeleton() {
    if (movieSkeletonGrid) movieSkeletonGrid.style.display = 'none';
}

function showMovieError(message) {
    if (movieSkeletonGrid) movieSkeletonGrid.style.display = 'none';
    if (movieGrid) movieGrid.style.display = 'none';
    if (movieEmptyState) movieEmptyState.style.display = 'none';
    if (movieErrorState) movieErrorState.style.display = 'flex';
    if (movieErrorMessage) movieErrorMessage.textContent = message;
}

// ==========================================================================
// ============= SEARCH MOVIES ==============================================
// ==========================================================================
async function searchMovies(query) {
    if (!query || !query.trim()) {
        showToast('Please enter a movie title', 'error');
        return;
    }

    showMovieSkeleton();
    movieSearchBtn?.classList.add('loading');
    if (movieSearchBtn) movieSearchBtn.disabled = true;

    try {
        const response = await fetch(
            `/movies/api/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = await response.json();

        hideMovieSkeleton();

        if (!response.ok || data.error) {
            showMovieError(data.error || 'Search failed');
            showToast(data.error || 'Search failed', 'error');
            return;
        }

        if (!data.movies || data.movies.length === 0) {
            if (movieEmptyState) movieEmptyState.style.display = 'flex';
            showToast(`No movies found for "${query}"`, 'error');
            return;
        }

        displayMovies(data.movies);
        showToast(`Found ${data.movies.length} movies`, 'success');

    } catch (error) {
        hideMovieSkeleton();
        console.error('Search error:', error);
        showMovieError('Connection error. Try again.');
        showToast('Connection error', 'error');
    } finally {
        movieSearchBtn?.classList.remove('loading');
        if (movieSearchBtn) movieSearchBtn.disabled = false;
    }
}

// ==========================================================================
// ============= DISPLAY MOVIES =============================================
// ==========================================================================
function displayMovies(movies) {
    if (!movieGrid) return;

    movieGrid.innerHTML = '';
    movieGrid.style.display = 'grid';

    movies.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.addEventListener('click', () => openMovieDetails(movie.id));

        const poster = movie.poster || 'https://via.placeholder.com/300x450/141A2B/4A8BFF?text=🎬';
        const rating = movie.rating ? Number(movie.rating).toFixed(1) : 'N/A';

        card.innerHTML = `
            <div class="movie-poster">
                <img src="${poster}"
                     alt="${escapeHtml(movie.title)}"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/300x450/141A2B/4A8BFF?text=🎬'">
                <span class="movie-rating">
                    <i class="bi bi-star-fill"></i> ${rating}
                </span>
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${escapeHtml(movie.title)}</h3>
                <p class="movie-year">${movie.year || 'Unknown'}</p>
            </div>
        `;

        movieGrid.appendChild(card);
    });
}

// ==========================================================================
// ============= OPEN MOVIE DETAILS MODAL ===================================
// ==========================================================================
async function openMovieDetails(movieId) {
    if (!movieModal || !modalBody) return;

    // Onyesha modal na loading
    movieModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    modalBody.innerHTML = `
        <div class="modal-loading">
            <div class="spinner"></div>
            <p>Loading movie details...</p>
        </div>
    `;

    try {
        const response = await fetch(`/movies/api/details/${movieId}`);
        const data = await response.json();

        if (!response.ok || data.error) {
            modalBody.innerHTML = `
                <div class="modal-loading">
                    <i class="bi bi-exclamation-triangle-fill" style="font-size:40px;color:#ff5a2c"></i>
                    <p>${escapeHtml(data.error || 'Failed to load details')}</p>
                </div>
            `;
            return;
        }

        renderMovieModal(data);

    } catch (error) {
        console.error('Details error:', error);
        modalBody.innerHTML = `
            <div class="modal-loading">
                <i class="bi bi-wifi-off" style="font-size:40px;color:#ff5a2c"></i>
                <p>Connection error. Please try again.</p>
            </div>
        `;
    }
}

// ==========================================================================
// ============= RENDER MODAL CONTENT =======================================
// ==========================================================================
function renderMovieModal(data) {
    if (!modalBody) return;

    const poster = data.poster || 'https://via.placeholder.com/300x450/141A2B/4A8BFF?text=🎬';
    const backdrop = data.backdrop || poster;
    const year = data.release_date ? data.release_date.split('-')[0] : 'N/A';
    const runtime = formatRuntime(data.runtime);
    const rating = data.rating ? Number(data.rating).toFixed(1) : 'N/A';

    const genresHtml = (data.genres || [])
        .map(g => `<span class="modal-genre-tag">${escapeHtml(g)}</span>`)
        .join('');

    const castHtml = (data.cast || [])
        .map(c => `<span class="cast-chip"><i class="bi bi-person"></i> ${escapeHtml(c)}</span>`)
        .join('');

    const trailerHtml = data.trailer_key ? `
        <div class="modal-section">
            <h4><i class="bi bi-play-circle"></i> Official Trailer</h4>
            <div class="modal-trailer">
                <iframe
                    src="https://www.youtube.com/embed/${data.trailer_key}"
                    title="${escapeHtml(data.title)} Trailer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen>
                </iframe>
            </div>
        </div>
    ` : '';

    const castSectionHtml = castHtml ? `
        <div class="modal-section">
            <h4><i class="bi bi-people"></i> Top Cast</h4>
            <div class="modal-cast">${castHtml}</div>
        </div>
    ` : '';

    modalBody.innerHTML = `
        <div class="modal-backdrop">
            <img src="${backdrop}"
                 alt="${escapeHtml(data.title)}"
                 onerror="this.style.display='none'">
        </div>

        <div class="modal-poster-info">
            <div class="modal-poster">
                <img src="${poster}"
                     alt="${escapeHtml(data.title)}"
                     onerror="this.src='https://via.placeholder.com/300x450/141A2B/4A8BFF?text=🎬'">
            </div>
            <div class="modal-info">
                <h2 class="modal-title">${escapeHtml(data.title)}</h2>
                <div class="modal-meta">
                    <span><i class="bi bi-calendar"></i> ${year}</span>
                    <span><i class="bi bi-clock"></i> ${runtime}</span>
                    <span class="rating"><i class="bi bi-star-fill"></i> ${rating}</span>
                </div>
                <div class="modal-genres">${genresHtml}</div>
            </div>
        </div>

        ${data.overview ? `
        <div class="modal-section">
            <h4><i class="bi bi-info-circle"></i> Overview</h4>
            <p class="modal-overview">${escapeHtml(data.overview)}</p>
        </div>
        ` : ''}

        ${trailerHtml}
        ${castSectionHtml}

        <div class="modal-actions">
            <button class="modal-btn primary" id="modalDownloadBtn">
                <i class="bi bi-download"></i> Download Movie
            </button>
            <button class="modal-btn secondary" id="modalShareBtn">
                <i class="bi bi-share"></i> Share
            </button>
        </div>
    `;

    // Attach handlers
    document.getElementById('modalDownloadBtn')?.addEventListener('click', () => {
        downloadMovie(data.id, data.title);
    });

    document.getElementById('modalShareBtn')?.addEventListener('click', () => {
        shareMovie(data.title);
    });
}

// ==========================================================================
// ============= CLOSE MODAL ================================================
// ==========================================================================
function closeModal() {
    if (!movieModal) return;
    movieModal.style.display = 'none';
    document.body.style.overflow = '';
    if (modalBody) modalBody.innerHTML = '';
}

modalClose?.addEventListener('click', closeModal);

movieModal?.addEventListener('click', (e) => {
    if (e.target === movieModal) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && movieModal?.style.display === 'flex') {
        closeModal();
    }
});

// ==========================================================================
// ============= SHARE MOVIE ================================================
// ==========================================================================
function shareMovie(title) {
    const shareUrl = window.location.href;

    if (navigator.share) {
        navigator.share({
            title: title,
            text: `Check out "${title}" on botDL!`,
            url: shareUrl
        }).catch(() => {
            // User cancelled — ignore
        });
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('Link copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Could not copy link', 'error');
        });
    } else {
        showToast('Share not supported on this device', 'error');
    }
}

// ==========================================================================
// ============= DOWNLOAD MOVIE =============================================
// ==========================================================================
async function downloadMovie(movieId, title) {
    const btn = document.getElementById('modalDownloadBtn');
    if (!btn) return;

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Searching...';
    showToast(`Preparing "${title}"...`, 'info');

    try {
        const response = await fetch(`/movies/api/download/${movieId}`);
        const data = await response.json();

        if (!response.ok || data.error) {
            showToast(data.error || 'Not available', 'error');
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            return;
        }

        // Kama response ni file direct (blob)
        if (data.file_url) {
            // Download file direct
            const a = document.createElement('a');
            a.href = data.file_url;
            a.download = `${sanitizeFilename(title)}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Done';
            showToast(`Downloaded: ${title}`, 'success');

            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }, 2000);
            return;
        }

        // Kama response ni magnet link (torrent)
        if (data.magnet_url) {
            // Onyesha download options kwenye modal
            const existingOptions = document.getElementById('downloadOptions');
            if (existingOptions) existingOptions.remove();

            if (modalBody) {
                modalBody.insertAdjacentHTML('beforeend', `
                    <div class="modal-section" id="downloadOptions">
                        <h4><i class="bi bi-download"></i> Download Options</h4>
                        <div class="download-options">
                            <div class="download-option">
                                <div>
                                    <strong>${escapeHtml(data.quality || 'HD')}</strong>
                                    <span>${escapeHtml(data.size || 'Unknown size')}</span>
                                </div>
                                <button class="modal-btn primary" id="copyMagnetBtn">
                                    <i class="bi bi-magnet"></i> Copy Magnet
                                </button>
                            </div>
                        </div>
                        <p class="download-note">
                            <i class="bi bi-info-circle"></i>
                            Copy magnet link and open in qBittorrent, uTorrent, or any torrent client.
                        </p>
                    </div>
                `);

                document.getElementById('copyMagnetBtn')?.addEventListener('click', () => {
                    copyMagnet(data.magnet_url);
                });

                // Scroll to options
                document.getElementById('downloadOptions')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }

            btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Available';
            showToast('Download available!', 'success');

            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }, 2000);
            return;
        }

        // Fallback
        showToast('No download link available', 'error');
        btn.innerHTML = originalHtml;
        btn.disabled = false;

    } catch (error) {
        console.error('Download error:', error);
        showToast('Download failed. Try again.', 'error');
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ==========================================================================
// ============= COPY MAGNET ================================================
// ==========================================================================
function copyMagnet(magnetUrl) {
    if (!magnetUrl) {
        showToast('No magnet link available', 'error');
        return;
    }

    if (navigator.clipboard) {
        navigator.clipboard.writeText(magnetUrl).then(() => {
            showToast('Magnet link copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = magnetUrl;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Magnet link copied!', 'success');
        });
    } else {
        showToast('Clipboard not supported', 'error');
    }
}

// ==========================================================================
// ============= EVENT LISTENERS ============================================
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Search button
    movieSearchBtn?.addEventListener('click', () => {
        searchMovies(movieInput?.value || '');
    });

    // Enter key
    movieInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchMovies(movieInput.value);
        }
    });

    // Clear button visibility
    movieInput?.addEventListener('input', () => {
        if (movieClearBtn) {
            movieClearBtn.style.display = movieInput.value.trim() ? 'flex' : 'none';
        }
    });

    // Clear button
    movieClearBtn?.addEventListener('click', () => {
        if (movieInput) {
            movieInput.value = '';
            movieInput.focus();
        }
        if (movieClearBtn) movieClearBtn.style.display = 'none';
        if (movieGrid) movieGrid.style.display = 'none';
        if (movieEmptyState) movieEmptyState.style.display = 'none';
        if (movieErrorState) movieErrorState.style.display = 'none';
    });

    // Quick tags
    document.querySelectorAll('.quick-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const query = tag.dataset.query;
            if (movieInput) movieInput.value = query;
            if (movieClearBtn) movieClearBtn.style.display = 'flex';
            searchMovies(query);
        });
    });

    // Animated name
    const animatedNameElement = document.getElementById('animatedName');
    if (animatedNameElement) {
        const fullName = 'Mohamed Watitu';
        animatedNameElement.innerHTML = '';
        fullName.split('').forEach(letter => {
            const span = document.createElement('span');
            span.textContent = letter;
            span.className = 'letter-jump';
            if (letter === ' ') {
                span.style.width = '0.3rem';
                span.style.minWidth = '0.3rem';
            }
            animatedNameElement.appendChild(span);
        });

        // Animate letters
        let idx = 0;
        setInterval(() => {
            const spans = animatedNameElement.querySelectorAll('.letter-jump');
            if (spans.length === 0) return;
            const span = spans[idx % spans.length];
            if (span && span.textContent.trim()) {
                span.classList.add('jumping');
                setTimeout(() => span.classList.remove('jumping'), 400);
            }
            idx++;
        }, 1200);
    }
});

// ==========================================================================
// ============= GLOBAL EXPORTS =============================================
// ==========================================================================
window.searchMovies = searchMovies;
window.openMovieDetails = openMovieDetails;
window.closeModal = closeModal;
window.shareMovie = shareMovie;
window.downloadMovie = downloadMovie;
window.copyMagnet = copyMagnet;
