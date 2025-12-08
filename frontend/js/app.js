// ═══════════════════════════════════════════════════════════════
// OMNIBOT - Main Application Module
// ═══════════════════════════════════════════════════════════════

import { state, saveConfig } from './state.js';
import { applyTheme, initTheme } from './themes.js';
import { sendMessage, addMessage, addTypingIndicator, removeTypingIndicator, clearChat } from './chat.js';
import { toggleVoiceInput, populateVoices } from './voice.js';

// DOM Elements cache
const elements = {};

// Initialize application
export function init() {
    cacheElements();
    bindEvents();
    initTheme();
    populateVoices();
    autoResizeTextarea();
    loadSettings();
}

// Cache DOM elements
function cacheElements() {
    elements.sidebar = document.getElementById('sidebar');
    elements.sidebarOverlay = document.getElementById('sidebarOverlay');
    elements.menuBtn = document.getElementById('menuBtn');
    elements.newChatBtn = document.getElementById('newChatBtn');
    elements.settingsBtn = document.getElementById('settingsBtn');
    elements.mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
    elements.settingsModal = document.getElementById('settingsModal');
    elements.closeModal = document.getElementById('closeModal');
    elements.cancelSettings = document.getElementById('cancelSettings');
    elements.saveSettings = document.getElementById('saveSettings');
    elements.messagesContainer = document.getElementById('messagesContainer');
    elements.emptyState = document.getElementById('emptyState');
    elements.messageInput = document.getElementById('messageInput');
    elements.sendBtn = document.getElementById('sendBtn');
    elements.voiceInputBtn = document.getElementById('voiceInputBtn');
    elements.voiceToggle = document.getElementById('voiceToggle');
    elements.clearChatBtn = document.getElementById('clearChatBtn');
    elements.themeBtns = document.querySelectorAll('.theme-btn');
    elements.suggestionChips = document.querySelectorAll('.suggestion-chip');
    elements.routerUrl = document.getElementById('routerUrl');
    elements.sharedSecret = document.getElementById('sharedSecret');
    elements.llmProvider = document.getElementById('llmProvider');
    elements.voiceSelect = document.getElementById('voiceSelect');
}

// Bind event listeners
function bindEvents() {
    // Mobile menu
    elements.menuBtn?.addEventListener('click', () => toggleSidebar());
    elements.sidebarOverlay?.addEventListener('click', () => toggleSidebar(false));

    // Settings modal
    elements.settingsBtn?.addEventListener('click', () => openSettings());
    elements.mobileSettingsBtn?.addEventListener('click', () => openSettings());
    elements.closeModal?.addEventListener('click', () => closeSettings());
    elements.cancelSettings?.addEventListener('click', () => closeSettings());
    elements.saveSettings?.addEventListener('click', () => saveSettingsHandler());
    elements.settingsModal?.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
    });

    // Theme switcher
    elements.themeBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTheme(btn.dataset.theme));
    });

    // Messages
    elements.sendBtn?.addEventListener('click', () => handleSendMessage());
    elements.messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    elements.messageInput?.addEventListener('input', () => autoResizeTextarea());

    // Suggestions
    elements.suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.messageInput.value = chip.textContent;
            handleSendMessage();
        });
    });

    // Voice
    elements.voiceInputBtn?.addEventListener('click', () => toggleVoiceInput(elements));

    // Clear chat
    elements.clearChatBtn?.addEventListener('click', () => clearChat(elements));
    elements.newChatBtn?.addEventListener('click', () => clearChat(elements));
}

// Theme switching with glitch effect
function switchTheme(theme) {
    document.body.classList.add('glitch-effect');
    setTimeout(() => {
        applyTheme(theme);
        document.body.classList.remove('glitch-effect');
    }, 150);
}

// Sidebar toggle
function toggleSidebar(open) {
    const isOpen = open ?? !elements.sidebar.classList.contains('open');
    elements.sidebar.classList.toggle('open', isOpen);
    elements.sidebarOverlay.classList.toggle('active', isOpen);
}

// Settings modal
function openSettings() {
    elements.routerUrl.value = state.config.routerUrl;
    elements.sharedSecret.value = state.config.sharedSecret;
    elements.llmProvider.value = state.config.llmProvider;
    elements.settingsModal.classList.add('active');
}

function closeSettings() {
    elements.settingsModal.classList.remove('active');
}

function loadSettings() {
    if (elements.routerUrl) elements.routerUrl.value = state.config.routerUrl;
    if (elements.sharedSecret) elements.sharedSecret.value = state.config.sharedSecret;
    if (elements.llmProvider) elements.llmProvider.value = state.config.llmProvider;
}

function saveSettingsHandler() {
    state.config.routerUrl = elements.routerUrl.value;
    state.config.sharedSecret = elements.sharedSecret.value;
    state.config.llmProvider = elements.llmProvider.value;
    saveConfig();
    closeSettings();
    addMessage('Settings saved successfully!', 'system', elements);
}

// Handle sending message
async function handleSendMessage() {
    const text = elements.messageInput.value.trim();
    if (!text) return;

    // Clear empty state
    if (elements.emptyState) {
        elements.emptyState.remove();
    }

    // Add user message
    addMessage(text, 'user', elements);
    elements.messageInput.value = '';
    autoResizeTextarea();

    // Show typing indicator
    const typingId = addTypingIndicator(elements);

    try {
        const response = await sendMessage(text);
        removeTypingIndicator(typingId);
        addMessage(response, 'ai', elements);
    } catch (error) {
        removeTypingIndicator(typingId);
        addMessage(`Error: ${error.message}`, 'system', elements);
    }
}

// Auto-resize textarea
function autoResizeTextarea() {
    const textarea = elements.messageInput;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// Export elements for other modules
export function getElements() {
    return elements;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => init());
