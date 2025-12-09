# Omnibot UI Features

## Overview
The Omnibot UI is a fully polished, modern web interface for interacting with the AI assistant. It features a comprehensive theming system, message editing capabilities, and robust error handling.

## Key Features

### 1. Message Editing (NEW)
- **Inline Editing**: Click the edit button (✏️) that appears on hover over your messages
- **Visual Feedback**: 
  - Editing message pulses with accent color
  - Input box highlights with blue gradient glow
  - Send button changes to save icon (💾)
  - Cancel button (❌) appears in secondary actions
- **Keyboard Shortcuts**:
  - `Enter` to save edited message
  - `Escape` to cancel editing
- **Edit Indicators**: Edited messages show "(edited)" label with border accent
- **No Dialogs**: All editing happens in the same chat input box

### 2. Theme System (14 Themes)
#### Dark Themes:
1. **Matrix** - Classic green terminal aesthetic
2. **Cyberpunk** - Neon pink/cyan with glow effects
3. **Borg** - Assimilation green with shadow effects
4. **HAL 9000** - Menacing red AI theme
5. **War Games** - Classic green monospace
6. **Modern Dark** - Blue/gray professional theme
7. **Tron Legacy** - Electric blue with light trails
8. **Neuromancer** - Purple cyberspace theme
9. **Alien Isolation** - CRT green retro-futuristic
10. **Dune** - Desert sand and spice colors
11. **Ghost in the Shell** - Holographic cyan/purple
12. **Interstellar** - Deep space blue gradient
13. **Synthwave** - Retro neon pink/cyan

#### Light Themes:
14. **Portal** - Clean Aperture Science white/orange/blue

### 3. Logging API
- **POST /api/log** - Store logs for debugging
  - Accepts: level, message, data, url
  - Stores with timestamp and user agent
  - 24-hour expiration in KV storage
  
- **GET /api/logs** - Retrieve recent logs
  - Returns last 50 logs
  - Sorted by timestamp (newest first)
  - Useful for remote debugging and testing

### 4. User Interface Components

#### Header
- Connection status indicator (pulsing green)
- LLM provider status
- Usage tracking (requests/limit)
- Mode indicator (Normal/Upgrade)
- Quick theme toggle button (☀️/🌙)
- Status refresh button
- Settings access

#### Chat Container
- Smooth scrolling message display
- Role labels (You/Omnibot)
- Timestamps on all messages
- System messages for status updates
- Error messages with visual distinction
- Typing indicator with animation
- Auto-scroll to bottom
- Scroll-to-bottom button (appears when needed)

#### Input Area
- Auto-resizing textarea (up to 200px)
- Voice input button (🎤) with live transcription
- Send button (➤)
- Secondary action buttons:
  - Code mode (</>)
  - Translate mode (🌐)
  - Swarm mode (🔗)
  - Upgrade mode (🔧)
  - Cancel edit (❌) - appears in edit mode

#### Settings Panel
- **Connection Settings**:
  - Router URL configuration
  - Shared secret for HMAC authentication
  
- **Theme Settings**:
  - Visual theme selector with 14 options
  - Instant theme preview
  - Theme persistence via localStorage
  - System preference detection
  
- **Smooth Transitions**:
  - Glassmorphism design
  - Slide-in animation
  - Backdrop blur effect

### 5. Responsive Design
- Mobile-first approach
- Breakpoints for tablets and phones
- Touch-optimized controls (44px minimum)
- Landscape mode optimizations
- Reduced motion support for accessibility

### 6. Accessibility Features
- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus indicators
- Screen reader announcements
- Semantic HTML structure
- High contrast theme options

### 7. Voice Features
- Web Speech API integration
- Live transcription overlay
- Recording indicator
- Error handling for permission issues
- Text-to-speech for responses
- Automatic form submission after voice input

### 8. Error Handling
- Network error detection
- Configuration validation
- Graceful degradation
- User-friendly error messages
- Debug logging (can be disabled)
- Automatic retry logic

### 9. Performance Optimizations
- CSS transitions and animations
- Efficient DOM updates
- Lazy loading of resources
- Minimal bundle size
- Fast initial load (<3 seconds)
- Smooth 60fps animations

### 10. Developer Features
- Comprehensive E2E test suite (Playwright)
- Debug logging system
- Fetch wrapper with request/response logging
- Console logging for troubleshooting
- Test-friendly DOM structure
- API endpoint for remote logging

## Technical Specifications

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari iOS 14+
- Chrome Mobile Android 90+

### Technologies
- Vanilla JavaScript (ES6+)
- CSS Variables for theming
- Web Speech API for voice
- Fetch API for networking
- LocalStorage for persistence
- HMAC SHA-256 for authentication

### Security
- HMAC authentication for all API calls
- Challenge-response protocol
- No inline scripts (CSP compatible)
- Secure secret storage
- XSS protection via text content

### Testing
- 18 comprehensive E2E tests
- Functional testing (not DOM-dependent)
- Mobile viewport testing
- Accessibility testing
- Error condition testing
- Performance benchmarks

## Deployment Pipeline

### Staging Environment
- **URL**: https://ad6fdc76.omnibot-ui-staging.pages.dev
- **Deployment**: Automatic on push to main
- **Testing**: Full E2E suite runs before deployment
- **Purpose**: Test changes in production-like environment

### Production Environment
- **URL**: https://omnibot-ui.pages.dev
- **Deployment**: Manual promotion from staging
- **Validation**: Requires "DEPLOY" confirmation
- **Safety**: Full test suite must pass on staging first
- **Rollback**: Automatic on health check failure

### CI/CD Pipeline
1. Push to main → Deploy to staging
2. Run E2E tests on staging
3. Manual review and testing
4. Promote to production (manual trigger)
5. Health checks on production
6. Smoke tests on production
7. Rollback if any issues detected

## Usage Examples

### Sending a Message
1. Type message in input box
2. Press Enter or click Send (➤)
3. View response from Omnibot
4. Optional: Use voice input (🎤)

### Editing a Message
1. Hover over your message
2. Click edit button (✏️)
3. Message loads into input box
4. Edit the text
5. Press Enter to save or Escape to cancel
6. Edited messages show "(edited)" indicator

### Changing Themes
Method 1 (Quick Toggle):
- Click sun/moon button in header
- Toggles between light and dark

Method 2 (Specific Theme):
1. Click Settings (⚙️)
2. Select theme from dropdown
3. Theme applies instantly
4. Close settings

### Voice Input
1. Click microphone button (🎤)
2. Grant microphone permissions (first time)
3. Speak your message
4. Transcription appears in input
5. Message sends automatically
6. Response is read aloud

## Future Enhancements
- [ ] Conversation export/import
- [ ] Code syntax highlighting
- [ ] Markdown rendering
- [ ] Image attachments
- [ ] Conversation search
- [ ] Message reactions
- [ ] Multi-language support
- [ ] Custom theme creator
- [ ] Voice activity detection
- [ ] Offline mode

## Contributing
See [README.md](README.md) for development setup and deployment instructions.

## License
MIT License - See LICENSE file for details
