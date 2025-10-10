// likeaghost.js
const STORAGE_KEY = 'likeaghost-theme';

function applyTheme(mode) {
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  if (mode === 'light') root.classList.add('theme-light');
  if (mode === 'dark') root.classList.add('theme-dark');
  root.style.colorScheme = (mode === 'light') ? 'light' : 'dark';
}

function detectInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function toggleTheme() {
  const next = document.documentElement.classList.contains('theme-dark') ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(STORAGE_KEY, next);
}

(function initTheme(){
  applyTheme(detectInitialTheme());
  const btn = document.querySelector('[data-theme-toggle]');
  if (btn) btn.addEventListener('click', toggleTheme);
})();