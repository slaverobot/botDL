// ============= THEME TOGGLE =============
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.className = theme === 'dark'
            ? 'bi bi-moon-stars-fill'
            : 'bi bi-sun-fill';
    }
}

applyTheme(localStorage.getItem('botdl-theme') || 'dark');

document.getElementById('themeToggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('botdl-theme', next);
});

// ============= ANIMATED NAME =============
const fullName = 'Mohamed Watitu';
const jumpColors = ['#4A8BFF', '#4DD0E1', '#4ADE80', '#4A8BFF', '#4DD0E1'];
let currentLetterIndex = 0;

function initAnimatedName() {
    const el = document.getElementById('animatedName');
    if (!el) return;

    el.innerHTML = '';
    fullName.split('').forEach(letter => {
        const span = document.createElement('span');
        span.textContent = letter;
        span.className = 'letter-jump';
        if (letter === ' ') {
            span.style.width = '0.3rem';
            span.style.minWidth = '0.3rem';
        }
        el.appendChild(span);
    });

    setInterval(() => {
        const spans = el.querySelectorAll('.letter-jump');
        if (spans.length === 0) return;
        const span = spans[currentLetterIndex % spans.length];
        if (span && span.textContent.trim()) {
            span.classList.add('jumping');
            span.style.color = jumpColors[currentLetterIndex % jumpColors.length];
            setTimeout(() => {
                span.classList.remove('jumping');
                span.style.color = '';
            }, 400);
        }
        currentLetterIndex++;
    }, 1200);
}

// ============= NAVBAR SCROLL =============
function handleNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > 50);
}

let scrollTimeout;
window.addEventListener('scroll', () => {
    if (scrollTimeout) return;
    scrollTimeout = requestAnimationFrame(() => {
        handleNavbarScroll();
        scrollTimeout = null;
    });
}, { passive: true });

// ============= PAGE LOAD =============
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.5s ease';
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
});

// ============= INIT =============
document.addEventListener('DOMContentLoaded', () => {
    initAnimatedName();
    handleNavbarScroll();
});
