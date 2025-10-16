# Omnibot UI Redesign Prompt for Gemini/Stitch

## Project Context
We're redesigning the UI for **Omnibot**, a voice-controlled AI assistant with automatic LLM provider rotation and self-upgrade capabilities. The current UI is functional but dated, with a heavy terminal/retro aesthetic that needs modernization while maintaining its sci-fi character.

## Current UI State

### Layout Structure
- **Header Bar**: Contains app title, status indicators (LLM provider, usage metrics, mode), and control buttons
- **Chat Container**: Scrollable message feed with user/assistant/system messages
- **Input Area**: Text input with voice recording button and send button
- **Settings Panel**: Slides in from right with theme selector, router URL, shared secret, and upgrade mode documentation

### Existing Themes (6 total)
1. **Matrix** (Default): Green terminal (#0f0 on black), high contrast
2. **Cyberpunk**: Neon pink/cyan (#ff00ff, #00ffff) on dark blue/purple
3. **Borg**: Green glow effects with shadows (#00ff00), assimilation aesthetic  
4. **HAL 9000**: Red on black (#ff0000), menacing AI theme
5. **War Games**: Classic green terminal (#00ff00), 1980s computing nostalgia
6. **Modern Dark**: Rounded corners, sans-serif font, blue/gray palette

### Current Issues
- **Not mobile-responsive**: Layout breaks or doesn't work on mobile devices (needs investigation)
- **Limited visual hierarchy**: Status bar, controls, and content compete for attention
- **Minimal animations**: Only basic pulse effect on recording button
- **Dated aesthetics**: Most themes feel very 2010s terminal emulator
- **Poor message differentiation**: Hard to distinguish user vs assistant messages quickly
- **No loading states**: No visual feedback during API calls
- **Settings panel is basic**: Just a form, no visual polish
- **Accessibility concerns**: Some themes have poor contrast, no focus indicators

### Key Functionality to Preserve
- **Voice input**: Click-to-speak with visual recording indicator
- **Real-time status**: LLM provider and usage limits displayed
- **Upgrade mode**: Special mode for system self-modification (needs visual emphasis)
- **Multi-theme support**: Easy theme switching
- **Chat history**: Scrollable conversation with clear role indicators
- **Settings management**: Configuration for router URL, API secret, theme selection

## Design Goals

### Primary Objectives
1. **Modernize the aesthetic** - Move from retro terminal to contemporary sci-fi interface
2. **Mobile-first responsive design** - Must work perfectly on phones, tablets, and desktop
3. **Improve usability** - Clearer visual hierarchy, better spacing, intuitive controls
4. **Enhance visual feedback** - Loading states, transitions, micro-interactions
5. **Maintain sci-fi character** - Keep the futuristic AI assistant vibe, just make it modern
6. **Accessibility** - WCAG 2.1 AA compliance, good contrast, keyboard navigation

### Visual Direction
Think: **Blade Runner 2049** meets **Arc Browser** meets **Linear app**
- Clean, minimalist interfaces with purposeful UI elements
- Sophisticated use of blur effects, gradients, and transparency
- Smooth animations and transitions (60fps)
- Modern color palettes with neon accents where appropriate
- Typography: Mix of modern sans-serif for UI, monospace for code/technical elements
- Generous use of whitespace (or dark-space)
- Glassmorphism/frosted glass effects for panels
- Subtle particle effects or animated backgrounds for themes
- Intelligent use of shadows and depth

### Specific Improvements Needed

#### 1. Header/Navigation
- Make status indicators more visually distinct (pill-shaped badges?)
- Improve button styling (icons + text, hover states, active states)
- Better responsive behavior (stack on mobile)
- Add connection status indicator (connected/disconnected)
- Consider hamburger menu for mobile

#### 2. Chat Interface
- **Message bubbles**: Modern chat bubble design with tails/pointers
- **Avatar/icons**: Small indicators for user vs AI
- **Typing indicator**: Animated dots when AI is thinking
- **Timestamps**: Subtle timestamps on messages
- **Message actions**: Copy, regenerate, feedback buttons per message
- **Better scrolling**: Smooth scroll, "scroll to bottom" button when not at bottom
- **Rich content**: Support for code blocks, lists, formatting in messages

#### 3. Input Area
- **Larger, more prominent input**: Make it obvious where to type
- **Voice button**: Larger, animated when recording (pulsing glow)
- **Send button**: Only enable when text is present
- **Character counter**: For longer messages
- **Multi-line support**: Auto-expand as you type
- **Quick actions**: Shortcuts for common commands

#### 4. Settings Panel
- **Better organization**: Sections with headers, icons
- **Visual theme previews**: Show color swatches or mini previews
- **Toggle switches**: Modern toggle UI instead of buttons where appropriate
- **Validation feedback**: Real-time validation for URLs, secrets
- **Improved about section**: Cards or expandable sections

#### 5. Mobile Experience
- **Touch-optimized**: Larger tap targets (44x44px minimum)
- **Swipe gestures**: Swipe to close settings, swipe to delete message
- **Native-feeling scrolling**: Momentum scrolling, pull-to-refresh
- **Responsive font sizes**: Scale appropriately
- **Safe area handling**: Respect notches, rounded corners
- **Portrait & landscape**: Works well in both orientations

#### 6. Loading & Error States
- **Loading spinner**: Elegant spinner or skeleton screens
- **Error messages**: Toast notifications or inline errors with actions
- **Empty states**: Beautiful illustrations/messages when chat is empty
- **Connection lost**: Clear indicator with retry action

## New Theme Requirements

### Add 5+ New Sci-Fi Themes (Total: 11+ themes)

Each theme should have:
- Primary background color
- Primary text color
- Accent color(s) for highlights
- Message bubble styles (user vs assistant)
- Button styles (normal, hover, active, disabled)
- Input field styling
- Settings panel styling
- Optional: Special effects (particles, gradients, animations)

### Suggested New Themes:

1. **Tron Legacy**
   - Black background with electric blue (#00D9FF) accents
   - Grid overlay patterns
   - Glowing lines and edges
   - Neon blue message bubbles with inner glow

2. **Neuromancer** 
   - Deep purple/magenta (#9B4F96, #FF00D4) cyberspace aesthetic
   - Abstract wireframe patterns
   - Holographic/iridescent effects
   - Purple-pink gradients

3. **Alien Isolation**
   - Retro-futuristic green CRT monitor (#33FF00)
   - Scan lines and screen flicker effects
   - Chunky pixels, 1970s computer aesthetic
   - High contrast green/amber on black

4. **Dune**
   - Desert sand tones (#D4A574, #8B6635) with spice blue (#0077BE)
   - Minimalist, ornate details
   - Sand texture overlays
   - Warm, prestigious feel

5. **Ghost in the Shell**
   - Purple-blue neon (#6E00FF, #00E5FF) on dark teal
   - Holographic interface elements
   - Japanese typography influences
   - Transparent layered UI panels

6. **Interstellar**
   - Deep space navy (#0A1128) with cosmic blue/white accents
   - Subtle star field background
   - Scientific, precise aesthetic
   - Clean, NASA-inspired UI elements

7. **Synthwave/Outrun** 
   - Hot pink (#FF0090) and cyan (#00FFFF) on dark purple
   - Retrowave sun/grid aesthetic
   - Neon glow effects everywhere
   - 1980s future vision

8. **Portal** (Aperture Science)
   - White/light gray clinical environment with orange (#FF8C00) and blue (#0096FF) accents
   - Clean, testing facility aesthetic
   - Rounded, friendly but technical
   - High-tech laboratory feel

## Technical Requirements

### Responsive Breakpoints
- Mobile: 320px - 767px
- Tablet: 768px - 1024px  
- Desktop: 1025px+

### Performance
- First contentful paint < 1.5s
- Time to interactive < 3.5s
- Smooth 60fps animations
- Optimized asset loading

### Browser Support
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- iOS Safari (latest 2 versions)
- Android Chrome (latest 2 versions)

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader friendly
- Focus indicators
- Sufficient color contrast (4.5:1 minimum)
- Reduced motion support

## Deliverables Requested

Please generate the following:

1. **Style Guide**
   - Color palettes for each theme
   - Typography scale (font sizes, weights, line heights)
   - Spacing system (margin/padding scale)
   - Component specifications

2. **Component Designs** (for each theme if possible)
   - Header/navigation bar
   - Message bubbles (user & assistant)
   - Input area with voice button
   - Settings panel
   - Loading states
   - Error states
   - Empty states

3. **Full Page Mockups**
   - Desktop view (1920x1080)
   - Tablet view (768x1024)
   - Mobile view (375x812)
   - Show at least 3-4 different themes in full

4. **Interaction Specs**
   - Animation timings and easing functions
   - Hover states
   - Active states
   - Transition effects
   - Micro-interactions

5. **Dark Mode Variations**
   - If not already dark, provide dark variants
   - Ensure all themes work well in low-light conditions

## Visual References

The redesign should feel like a blend of:
- **Arc Browser**: Clean, modern, thoughtful interactions
- **Linear**: Keyboard-first, fast, beautiful animations
- **Raycast**: Polished, professional, sci-fi aesthetic
- **Vercel**: Minimalist, high contrast, precise
- **Stripe Dashboard**: Clear hierarchy, excellent use of space
- **Apple HIG**: Attention to detail, consistency

But with a **stronger sci-fi/AI assistant personality** - this is a tool for talking to artificial intelligence, so it should feel advanced, powerful, and slightly futuristic.

## Constraints & Considerations

1. **Single HTML file**: All CSS must be inline or in a style tag (no external stylesheets initially)
2. **No build step**: Pure HTML/CSS/JS, no React/Vue/framework needed
3. **Web Speech API**: Must accommodate browser speech recognition UI
4. **Theme switching**: Must support dynamic theme switching without page reload
5. **Local storage**: Settings persist via localStorage
6. **No backend required**: Entirely client-side except API calls

## Questions to Consider

- How can we make the "upgrade mode" feel special and powerful?
- What visual metaphor represents AI processing/thinking?
- How do we differentiate between normal chat and system modification mode?
- What makes voice input feel more tactile and responsive?
- How can themes have personality without being overwhelming?
- What empty state makes users want to start talking?

## Success Criteria

The redesign is successful if:
✅ Users immediately understand how to interact with the interface
✅ Mobile experience is delightful and fully functional  
✅ Themes are visually distinct but all equally polished
✅ The AI assistant feels intelligent and responsive
✅ Professional enough for serious use, fun enough to enjoy
✅ Accessible to users with various abilities
✅ Performance is excellent across devices

---

**Please generate comprehensive UI designs that bring Omnibot into 2025 with a modern, polished, sci-fi interface that works beautifully on all devices.**
