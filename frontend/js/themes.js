// ═══════════════════════════════════════════════════════════════
// OMNIBOT - Theme Management Module
// ═══════════════════════════════════════════════════════════════

import { state, saveTheme } from './state.js';

// Available themes
export const themes = [
    { id: 'matrix', name: 'Matrix', description: 'Digital Rain' },
    { id: 'blade-runner', name: 'Blade Runner', description: 'Neon Noir 2049' },
    { id: 'ghost', name: 'Ghost', description: 'Digital Consciousness' },
    { id: 'tron', name: 'Tron', description: 'The Grid' },
    { id: 'neuromancer', name: 'Neuromancer', description: 'Cyberspace' },
    { id: 'akira', name: 'Akira', description: 'Neo-Tokyo' },
    { id: 'hal', name: 'HAL 9000', description: 'I\'m Sorry Dave' },
    { id: 'synthwave', name: 'Synthwave', description: 'Retrowave Dreams' }
];

// Apply theme to document
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.currentTheme = theme;
    saveTheme();
    updateThemeButtons(theme);
}

// Update theme button active states
function updateThemeButtons(activeTheme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === activeTheme);
    });
}

// Get current theme
export function getCurrentTheme() {
    return state.currentTheme;
}

// Initialize theme on load
export function initTheme() {
    applyTheme(state.currentTheme);
}

// Get theme by ID
export function getTheme(id) {
    return themes.find(t => t.id === id);
}

// Get all themes
export function getAllThemes() {
    return themes;
}
