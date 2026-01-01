/**
 * Initialize theme before React renders to prevent flash
 * This runs synchronously before any React code executes
 */
export function initTheme() {
  const STORAGE_KEY = 'theme';
  
  // Read from localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  
  // Determine theme
  let theme: 'light' | 'dark' = 'light';
  if (saved === 'light' || saved === 'dark') {
    theme = saved;
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    theme = 'dark';
  }
  
  // Apply immediately to prevent flash
  document.documentElement.setAttribute('data-theme', theme);
  
  return theme;
}







