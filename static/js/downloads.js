// ==========================================================================
// ============= STATE ======================================================
// ==========================================================================
let currentAudio = null;
let currentPlayingBtn = null;
let currentTab = 'youtube';
let currentPage = 1;
let currentQuery = '';
let currentGenre = '';
const PER_PAGE = 20;

// ==========================================================================
// ============= DOM ELEMENTS ==============================================
// ==========================================================================
const itunesInput = document.getElementById('itunesInput');
const itunesClearBtn = document.getElementById('itunesClearBtn');
const itunesSearchBtn = document.getElementById('itunesSearchBtn');

const jamendoInput = document.getElementById('jamendoInput');
const jamendoClearBtn = document.getElementById('jamendoClearBtn');
const jamendoSearchBtn = document.getElementById('jamendoSearchBtn');

const resultsGrid = document.getElementById('resultsGrid');
const skeletonGrid = document.getElementById('skeletonGrid');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const pagination = document.getElementById('pagination');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const toastContainer = document.getElementById('toastContainer');

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
// ============= STATE HELPERS ==============================================
// ==========================================================================
function hideAll() {
    if (resultsGrid) resultsGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    if (skeletonGrid) skeletonGrid.classList.remove('active');
}

function showSkeleton() {
    hideAll();
    if (skeletonGrid) skeletonGrid.classList.add('active');
}

function showEmpty() {
    hideAll();
    if (emptyState) emptyState.style.display = 'flex';
}

function showError(message) {
    hideAll();
    if (errorState) errorState.style.display = 'flex';
    if (errorMessage) errorMessage.textContent = message;
}

// ==========================================================================
// ============= TAB SWITCHER ===============================================
// ==========================================================================
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab === currentTab) return;

            currentTab = tab;

            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tab}`)?.classList.add('active');

            hideAll();
        });
    });
}

// ==========================================================================
// ============= ITUNES SEARCH ==============================================
// ==========================================================================
async function searchItunes(query) {
    if (!query || query.trim() === '') {
        showToast('Please enter a song or artist name', 'error');
        return;
    }

    currentQuery = query.trim();

    showSkeleton();
    if (itunesSearchBtn) {
        itunesSearchBtn.classList.add('loading');
        itunesSearchBtn.disabled = true;
    }

    try {
        const response = await fetch(
            `/api/itunes/search?q=${encodeURIComponent(currentQuery)}&limit=25`
        );
        const data = await response.json();

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

        displayItunesTracks(data.tracks);
        showToast(`Found ${data.tracks.length} tracks`, 'success');

    } catch (error) {
        console.error('iTunes search error:', error);
        showError('Connection error. Please try again.');
        showToast('Connection error', 'error');
    } finally {
        if (itunesSearchBtn) {
            itunesSearchBtn.classList.remove('loading');
            itunesSearchBtn.disabled = false;
        }
    }
}

function displayItunesTracks(tracks) {
    if (!resultsGrid) return;
    hideAll();
    resultsGrid.innerHTML = '';
    resultsGrid.style.display = 'grid';

    tracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'song-card';
        const duration = formatDuration(track.duration);
        const image = track.image || 'https://via.placeholder.com/300x300/141A2B/4A8BFF?text=🎵';

        card.innerHTML = `
            <div class="song-thumbnail-wrapper">
                <img src="${image}" alt="${escapeHtml(track.title)}" loading="lazy"
                     onerror="this.src='https://via.placeholder.com/300x300/141A2B/4A8BFF?text=🎵'">
                <span class="song-duration">${duration}</span>
                <span class="source-badge">botDL</span>
            </div>
            <div class="song-info">
                <h3 class="song-title">${escapeHtml(track.title)}</h3>
                <p class="song-artist">
                    <i class="bi bi-person"></i>
                    ${escapeHtml(track.artist)}
                </p>
                <div class="song-actions">
                    <button class="preview-btn" 
                            data-audio="${escapeHtml(track.preview || '')}">
                        <i class="bi bi-play-fill"></i> Preview
                    </button>
                    <button class="download-btn itunes-download"
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

    resultsGrid.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', handlePreview);
    });

    resultsGrid.querySelectorAll('.itunes-download').forEach(btn => {
        btn.addEventListener('click', handleItunesDownload);
    });
}

// ==========================================================================
// ============= ITUNES DOWNLOAD (Full song via yt-dlp) =====================
// ==========================================================================
async function handleItunesDownload(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const title = btn.dataset.title;
    const artist = btn.dataset.artist;

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Downloading...';
    showToast(`Downloading "${title}"...`, 'info');

    try {
        const params = new URLSearchParams({ title, artist });
        const response = await fetch(`/api/itunes/download-full?${params}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Download failed');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeFilename(artist)} - ${sanitizeFilename(title)}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        showToast(`"${title}" downloaded!`, 'success');
        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Done';

        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Download error:', error);
        showToast(error.message || 'Download failed. Try again.', 'error');
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ==========================================================================
// ============= JAMENDO SEARCH =============================================
// ==========================================================================
async function searchJamendo(query, genre = '', page = 1) {
    if (!query || query.trim() === '') {
        showToast('Please enter an artist or song name', 'error');
        return;
    }

    currentQuery = query.trim();
    currentGenre = genre;
    currentPage = page;

    showSkeleton();
    if (jamendoSearchBtn) {
        jamendoSearchBtn.classList.add('loading');
        jamendoSearchBtn.disabled = true;
    }

    try {
        const offset = (page - 1) * PER_PAGE;
        let url = `/api/jamendo/search?q=${encodeURIComponent(currentQuery)}&limit=${PER_PAGE}&offset=${offset}`;
        if (genre) {
            url += `&genre=${encodeURIComponent(genre)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

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

        displayJamendoTracks(data.tracks);
        showPagination(data.total || data.tracks.length, page);
        showToast(`Found ${data.tracks.length} tracks from Jamendo`, 'success');

    } catch (error) {
        console.error('Jamendo search error:', error);
        showError('Connection error. Please try again.');
        showToast('Connection error', 'error');
    } finally {
        if (jamendoSearchBtn) {
            jamendoSearchBtn.classList.remove('loading');
            jamendoSearchBtn.disabled = false;
        }
    }
}

function displayJamendoTracks(tracks) {
    if (!resultsGrid) return;
    hideAll();
    resultsGrid.innerHTML = '';
    resultsGrid.style.display = 'grid';

    tracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'song-card';
        const duration = formatDuration(track.duration);
        const image = track.image || 'https://via.placeholder.com/300x300/141A2B/4A8BFF?text=🎵';

        card.innerHTML = `
            <div class="song-thumbnail-wrapper">
                <img src="${image}" alt="${escapeHtml(track.title)}" loading="lazy"
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
                            data-title="${escapeHtml(track.title)}">
                        <i class="bi bi-download"></i> Download
                    </button>
                </div>
            </div>
        `;
        resultsGrid.appendChild(card);
    });

    document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', handlePreview);
    });
    document.querySelectorAll('.download-btn:not(.itunes-download)').forEach(btn => {
        btn.addEventListener('click', handleDownload);
    });
}

// ==========================================================================
// ============= PAGINATION (Jamendo pekee) =================================
// ==========================================================================
function showPagination(total, page) {
    if (!pagination) return;
    pagination.style.display = 'flex';
    if (pageInfo) pageInfo.textContent = `Page ${page}`;
    if (prevPage) prevPage.disabled = page <= 1;
    if (nextPage) nextPage.disabled = total < PER_PAGE;
}

function initPagination() {
    prevPage?.addEventListener('click', () => {
        if (currentPage > 1) {
            searchJamendo(currentQuery, currentGenre, currentPage - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    nextPage?.addEventListener('click', () => {
        searchJamendo(currentQuery, currentGenre, currentPage + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ==========================================================================
// ============= PREVIEW HANDLER (Shared) ===================================
// ==========================================================================
function handlePreview(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const audioUrl = btn.dataset.audio;

    if (!audioUrl) {
        showToast('Preview not available', 'error');
        return;
    }

    if (currentAudio && currentPlayingBtn === btn) {
        currentAudio.pause();
        currentAudio = null;
        btn.classList.remove('playing');
        btn.innerHTML = '<i class="bi bi-play-fill"></i> Preview';
        currentPlayingBtn = null;
        return;
    }

    if (currentAudio) {
        currentAudio.pause();
        if (currentPlayingBtn) {
            currentPlayingBtn.classList.remove('playing');
            currentPlayingBtn.innerHTML = '<i class="bi bi-play-fill"></i> Preview';
        }
    }

    currentAudio = new Audio(audioUrl);
    currentPlayingBtn = btn;
    btn.classList.add('playing');
    btn.innerHTML = '<i class="bi bi-pause-fill"></i> Playing';

    currentAudio.play().catch(() => {
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
// ============= DOWNLOAD HANDLER (Jamendo pekee) ===========================
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

    const a = document.createElement('a');
    a.href = `/api/jamendo/download?id=${trackId}`;
    a.download = `${sanitizeFilename(title)}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Done';
        showToast(`"${title}" download started!`, 'success');
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }, 2000);
    }, 1500);
}

// ==========================================================================
// ============= HELPERS ====================================================
// ==========================================================================
function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return '--:--';
    const total = Math.floor(Number(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

function sanitizeFilename(name) {
    if (!name) return 'audio';
    return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim().substring(0, 80);
}

// ==========================================================================
// ============= EVENT LISTENERS ============================================
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initPagination();

    // ============ iTunes ============
    itunesSearchBtn?.addEventListener('click', () => {
        searchItunes(itunesInput?.value || '');
    });
    itunesInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchItunes(itunesInput.value);
    });
    itunesInput?.addEventListener('input', () => {
        if (itunesClearBtn) {
            itunesClearBtn.style.display = itunesInput.value.trim() ? 'flex' : 'none';
        }
    });
    itunesClearBtn?.addEventListener('click', () => {
        itunesInput.value = '';
        itunesClearBtn.style.display = 'none';
        itunesInput.focus();
    });

    document.querySelectorAll('#tab-youtube .quick-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const query = tag.dataset.query;
            if (itunesInput) itunesInput.value = query;
            if (itunesClearBtn) itunesClearBtn.style.display = 'flex';
            searchItunes(query);
        });
    });

    // ============ Jamendo ============
    jamendoSearchBtn?.addEventListener('click', () => {
        searchJamendo(jamendoInput?.value || '', currentGenre, 1);
    });
    jamendoInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchJamendo(jamendoInput.value, currentGenre, 1);
    });
    jamendoInput?.addEventListener('input', () => {
        if (jamendoClearBtn) {
            jamendoClearBtn.style.display = jamendoInput.value.trim() ? 'flex' : 'none';
        }
    });
    jamendoClearBtn?.addEventListener('click', () => {
        jamendoInput.value = '';
        jamendoClearBtn.style.display = 'none';
        jamendoInput.focus();
    });

    document.querySelectorAll('.genre-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            document.querySelectorAll('.genre-tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            const genre = tag.dataset.genre;
            if (jamendoInput?.value.trim()) {
                searchJamendo(jamendoInput.value, genre, 1);
            } else {
                currentGenre = genre;
            }
        });
    });

    document.querySelectorAll('#tab-jamendo .quick-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const query = tag.dataset.query;
            if (jamendoInput) jamendoInput.value = query;
            if (jamendoClearBtn) jamendoClearBtn.style.display = 'flex';
            searchJamendo(query, currentGenre, 1);
        });
    });
});

// ==========================================================================
// ============= GLOBAL EXPORTS =============================================
// ==========================================================================
window.searchItunes = searchItunes;
window.searchJamendo = searchJamendo;
