// ═══════════════════════════════════════════════════════════════
// OMNIBOT - Voice Module
// ═══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { addMessage } from './chat.js';

let recognition = null;

// Toggle voice input
export function toggleVoiceInput(elements) {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        addMessage('Speech recognition not supported in this browser', 'system', elements);
        return;
    }

    if (state.isListening) {
        recognition?.stop();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        state.isListening = true;
        elements.voiceInputBtn?.classList.add('voice-active');
    };

    recognition.onend = () => {
        state.isListening = false;
        elements.voiceInputBtn?.classList.remove('voice-active');
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        state.isListening = false;
        elements.voiceInputBtn?.classList.remove('voice-active');
        if (event.error !== 'no-speech') {
            addMessage(`Voice error: ${event.error}`, 'system', elements);
        }
    };

    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
        
        if (elements.messageInput) {
            elements.messageInput.value = transcript;
            elements.messageInput.dispatchEvent(new Event('input'));
        }
    };

    recognition.start();
}

// Speak text using TTS
export function speak(text, elements) {
    if (!state.config.voiceEnabled || !('speechSynthesis' in window)) {
        return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Get selected voice
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect && voiceSelect.value !== 'default') {
        const voices = speechSynthesis.getVoices();
        const voiceIndex = parseInt(voiceSelect.value);
        if (voices[voiceIndex]) {
            utterance.voice = voices[voiceIndex];
        }
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
        state.isSpeaking = true;
    };

    utterance.onend = () => {
        state.isSpeaking = false;
    };

    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        state.isSpeaking = false;
    };

    speechSynthesis.speak(utterance);
}

// Stop speaking
export function stopSpeaking() {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        state.isSpeaking = false;
    }
}

// Populate voice options
export function populateVoices() {
    if (!('speechSynthesis' in window)) {
        return;
    }

    const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        const voiceSelect = document.getElementById('voiceSelect');
        
        if (!voiceSelect) return;
        
        voiceSelect.innerHTML = '<option value="default">System Default</option>';
        
        voices.forEach((voice, i) => {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
        });
    };

    // Chrome loads voices asynchronously
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    // Try loading immediately too
    loadVoices();
}

// Toggle voice output
export function toggleVoiceOutput() {
    state.config.voiceEnabled = !state.config.voiceEnabled;
    localStorage.setItem('omnibot-voice', state.config.voiceEnabled);
    return state.config.voiceEnabled;
}
