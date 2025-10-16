# Mobile UI Investigation Task

## Issue
The current Omnibot UI reportedly doesn't work properly on mobile devices. Need to investigate and document the specific problems.

## Things to Test

### 1. Layout Issues
- [ ] Does the header wrap properly on small screens?
- [ ] Are buttons too small to tap comfortably? (Should be 44x44px minimum)
- [ ] Does the chat container scroll properly?
- [ ] Is the input area accessible when keyboard is visible?
- [ ] Does the settings panel work on mobile?
- [ ] Are all elements visible/accessible?

### 2. Functionality Issues  
- [ ] Does voice input work on mobile browsers?
- [ ] Can users send messages?
- [ ] Does the settings panel slide in/out correctly?
- [ ] Are there any JavaScript errors in mobile console?
- [ ] Does theme switching work?
- [ ] Do buttons respond to touch events?

### 3. Browser-Specific Issues
- [ ] iOS Safari
- [ ] iOS Chrome
- [ ] Android Chrome
- [ ] Android Firefox
- [ ] Android Samsung Internet

### 4. Viewport Issues
- [ ] Is viewport meta tag correct?
- [ ] Do elements scale properly?
- [ ] Is text readable without zooming?
- [ ] Are there horizontal scroll issues?

### 5. Interaction Issues
- [ ] Touch targets too small?
- [ ] Scrolling janky or broken?
- [ ] Gestures conflicting?
- [ ] Keyboard covering input?
- [ ] Safe area issues (notch, rounded corners)?

### 6. Web Speech API Mobile Support
- [ ] Does webkitSpeechRecognition work on iOS?
- [ ] Does it work on Android?
- [ ] Are there permission issues?
- [ ] Does TTS work on mobile?

## Current Known Issues

Based on code review:
- No media queries for responsive design
- Fixed widths on some elements (settings panel: 400px)
- No touch-specific interactions
- Web Speech API may not work on iOS (Safari doesn't support it well)
- No mobile-specific optimizations

## Fix Strategy

1. **Add media queries** for mobile/tablet breakpoints
2. **Increase touch targets** to minimum 44x44px
3. **Flexible layouts** - use flexbox/grid properly
4. **Mobile keyboard handling** - adjust viewport when keyboard appears
5. **Alternative to Web Speech API** - Consider native device APIs or fallback
6. **Test on real devices** - Use BrowserStack or real devices
7. **Performance optimization** - Reduce animations on mobile if needed

## Files to Modify
- `/Users/jonan/src/claudebox/omnibot/frontend/index.html` (main UI file)

## Testing URLs
- Router: https://omni-agent-router.jonanscheffler.workers.dev
- Frontend: (needs deployment)

## Priority
🔴 HIGH - Mobile is critical for voice assistant usability
