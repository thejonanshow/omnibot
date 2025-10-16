# Mobile Testing & Troubleshooting Guide

## 🎯 Quick Setup (Mobile Device)

### Step 1: Open Frontend
1. On your mobile device, open: **[Your Frontend URL]**
2. Accept any security warnings (self-signed certs)
3. You should see the Omnibot interface

### Step 2: Configure Settings
1. Tap the **⚙️ Settings** button (top right)
2. Enter:
   - **Router URL**: `https://omnibot-router.jonanscheffler.workers.dev`
   - **Shared Secret**: (copy from deployment-urls.txt)
3. Tap **💾 Save**

### Step 3: Test Connection
1. Tap **📊 Status** button to verify connection
2. You should see provider usage stats (Groq: X/30, etc.)
3. If you see "Status failed", check troubleshooting below

### Step 4: Test Voice
1. Tap the **🎤** microphone button
2. Allow microphone permissions when prompted
3. Speak a test message: "Hello, can you hear me?"
4. Button should pulse while recording
5. Message should appear and get a response

## ✅ Pre-Deployment Checklist

Before testing on mobile:
- [ ] Worker deployed to Cloudflare
- [ ] Frontend deployed to Cloudflare Pages
- [ ] Worker URL uses HTTPS (required for voice)
- [ ] CORS headers configured in worker
- [ ] SHARED_SECRET matches in worker and UI
- [ ] Cloudflare SSL/TLS set to "Flexible" or "Full"

## 🔍 Mobile Connectivity Tests

Run these tests to verify mobile connectivity:

```bash
# Test from your computer first
cd /Users/jonan/src/claudebox/omnibot
node scripts/test_mobile_connectivity.js
```

**What it tests:**
- ✅ Worker health endpoint
- ✅ CORS headers (critical for mobile)
- ✅ Challenge generation
- ✅ HMAC authentication
- ✅ Status endpoint
- ✅ Response times
- ✅ HTTPS connection
- ✅ DNS resolution

## 🐛 Common Mobile Issues & Fixes

### Issue 1: "Could not connect" / "Network error"

**Symptoms:**
- Can't connect when opening the app
- Status button shows error
- No responses to messages

**Causes & Fixes:**
1. **Wrong Worker URL**
   - ✅ Check Settings → Router URL matches exactly
   - ✅ Should be: `https://omnibot-router.jonanscheffler.workers.dev`
   - ❌ Not: `http://` or missing `.workers.dev`

2. **CORS not configured**
   - ✅ Worker must have CORS headers (already implemented)
   - Test: `curl -H "Origin: https://example.com" https://your-worker.workers.dev/health`
   - Should return `Access-Control-Allow-Origin: *` header

3. **Cloudflare SSL issues**
   - ✅ Go to Cloudflare dashboard → SSL/TLS
   - Set to "Flexible" or "Full"
   - Not "Off" or "Full (strict)" unless you have valid certs

4. **Wrong Shared Secret**
   - ✅ Must match exactly between UI and worker
   - Get from: `cat deployment-urls.txt`
   - No spaces, case-sensitive

### Issue 2: Voice button doesn't work

**Symptoms:**
- Mic button doesn't do anything
- No permission prompt
- "Speech recognition not supported" message

**Causes & Fixes:**
1. **Not using HTTPS**
   - ❌ `http://` will NOT work for voice
   - ✅ Must use `https://` (Cloudflare provides this)

2. **Browser doesn't support Web Speech API**
   - ✅ Use Chrome or Edge on Android
   - ✅ Use Safari on iOS
   - ❌ Firefox on mobile doesn't support it well

3. **Microphone permissions denied**
   - Go to browser settings
   - Clear permissions for the site
   - Reload and allow when prompted

4. **iOS Safari limitations**
   - iOS Safari has limited Web Speech API support
   - May need to use Chrome on iOS instead
   - Or wait for iOS to improve support

### Issue 3: UI looks broken on mobile

**Symptoms:**
- Buttons too small
- Text overlapping
- Can't scroll properly
- Layout doesn't fit screen

**Fixes:**
1. **Clear browser cache**
   ```
   - Settings → Privacy → Clear browsing data
   - Check "Cached images and files"
   - Clear
   ```

2. **Force refresh the page**
   - On iOS: Pull down to refresh
   - On Android: Menu → Refresh
   - Or close tab and reopen

3. **Check viewport**
   - The new UI includes proper viewport meta tag
   - If you see old UI, it's cached - clear cache

4. **Try different browser**
   - Chrome works best on Android
   - Safari works best on iOS
   - Edge is also good on both

### Issue 4: Messages not sending

**Symptoms:**
- Type message, hit send, nothing happens
- Message appears but no response
- Long delay then error

**Causes & Fixes:**
1. **Rate limited**
   - Check Status button
   - If Groq shows 30/30, you hit daily limit
   - Wait until tomorrow or add more API keys

2. **HMAC signature invalid**
   - Check browser console (if available)
   - Make sure Shared Secret is correct
   - Challenge may have expired (60s timeout)

3. **Worker error**
   - Check Cloudflare dashboard → Workers → Logs
   - Look for errors
   - May need to redeploy worker

4. **Provider API down**
   - Groq, Gemini, or Claude might be down
   - Check status pages:
     - Groq: https://status.groq.com
     - Anthropic: https://status.anthropic.com
     - Google: https://status.cloud.google.com

### Issue 5: Themes look wrong

**Symptoms:**
- Colors are messed up
- Text unreadable
- Borders missing
- Gradients not showing

**Fixes:**
1. **Switch themes**
   - Settings → Theme dropdown
   - Try "Modern Dark" first (most compatible)
   - Then try sci-fi themes

2. **Browser CSS support**
   - Some old browsers don't support CSS variables
   - Update your browser to latest version
   - Use Chrome/Safari/Edge (not old Android browser)

3. **Clear cache and reload**
   - Cache might have old CSS
   - Force refresh (Ctrl+Shift+R or Cmd+Shift+R)

## 📱 Browser-Specific Issues

### iOS Safari
**Known Issues:**
- Web Speech API has limited support
- May not work reliably
- Background tab issues

**Solutions:**
- Use Chrome for iOS if voice is important
- Keep app in foreground while using voice
- Or use text input instead

### Android Chrome
**Usually works great!**
- Full Web Speech API support
- HTTPS required
- Make sure Chrome is updated

### Samsung Internet
**Works but quirky:**
- Web Speech API support varies
- Try Chrome instead if issues
- Some themes may render differently

## 🧪 Testing Checklist

Before calling mobile "working", test these:

### Connection Tests
- [ ] Can access frontend URL
- [ ] Settings panel opens
- [ ] Status button returns usage stats
- [ ] Challenge endpoint returns valid challenge

### UI Tests
- [ ] All buttons are tappable (44x44px minimum)
- [ ] Text is readable
- [ ] Messages display correctly
- [ ] Can scroll smoothly
- [ ] Themes switch properly
- [ ] Input area visible when keyboard open

### Functionality Tests
- [ ] Can send text message and get response
- [ ] Voice button shows permission prompt
- [ ] Voice recording works (button pulses)
- [ ] Voice transcription appears in input
- [ ] Response is spoken out loud (if voice used)
- [ ] Conversation history saves
- [ ] Settings persist on reload

### Responsiveness Tests
- [ ] Test in portrait orientation
- [ ] Test in landscape orientation
- [ ] Test with keyboard open
- [ ] Test on different screen sizes
- [ ] Pinch-to-zoom works appropriately
- [ ] No horizontal scrolling

## 🔬 Advanced Debugging

### Check Worker Logs
```bash
# View real-time logs
cd /Users/jonan/src/claudebox/omnibot/cloudflare-worker
npx wrangler tail
```

### Test Worker Endpoints Manually

**Health Check:**
```bash
curl https://omnibot-router.jonanscheffler.workers.dev/health
# Should return: {"status":"ok",...}
```

**Get Challenge:**
```bash
curl https://omnibot-router.jonanscheffler.workers.dev/challenge
# Should return: {"challenge":"...","timestamp":...}
```

**Check Status:**
```bash
curl https://omnibot-router.jonanscheffler.workers.dev/status
# Should return: {"groq":0,"gemini":0,"claude":0}
```

**Test CORS:**
```bash
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Challenge" \
     https://omnibot-router.jonanscheffler.workers.dev/health -v
# Check for Access-Control-Allow-Origin header
```

### Check Browser Console (Mobile)

**On Android Chrome:**
1. Connect phone to computer via USB
2. Open Chrome on computer
3. Go to `chrome://inspect`
4. Select your device
5. Click "inspect" on the Omnibot tab
6. Check Console tab for errors

**On iOS Safari:**
1. Enable Web Inspector: Settings → Safari → Advanced → Web Inspector
2. Connect phone to Mac
3. Open Safari on Mac
4. Develop menu → [Your Phone] → [Omnibot Tab]
5. Check Console for errors

## 📊 Performance Optimization

For best mobile performance:

1. **Use WiFi** for initial tests
   - Cellular data works but may be slower
   - Voice requires good connection

2. **Close other apps**
   - Free up RAM
   - Reduce background processes

3. **Update your browser**
   - Latest Chrome/Safari/Edge
   - Security and performance updates

4. **Clear browser cache regularly**
   - Old cached data can cause issues
   - Fresh start helps

## 🆘 Still Not Working?

If you've tried everything above:

1. **Try on desktop first**
   - If desktop doesn't work, fix that first
   - Mobile issues are harder to debug

2. **Check Cloudflare status**
   - https://www.cloudflarestatus.com
   - Service might be down

3. **Verify API keys**
   - Groq, Gemini, Claude API keys valid
   - Check in wrangler.toml
   - Test keys in API dashboards

4. **Redeploy everything**
   ```bash
   cd /Users/jonan/src/claudebox/omnibot
   ./deploy_complete.sh
   ```

5. **Check GitHub issues**
   - https://github.com/thejonanshow/omnibot/issues
   - Someone may have reported same issue

## 📚 Additional Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Web Speech API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- **CORS Guide**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **Mobile Web Best Practices**: https://web.dev/mobile/

---

## ✅ Success Criteria

Mobile is "working" when:
- ✅ Can access frontend on mobile device
- ✅ Can configure settings
- ✅ Status check returns data
- ✅ Can send text messages and get responses
- ✅ Voice button requests permissions (even if you deny)
- ✅ UI is responsive and readable
- ✅ No console errors in browser

**Voice is a bonus!** If voice doesn't work but everything else does, that's still a success. Voice depends on:
- HTTPS ✅
- Browser support (varies)
- Microphone permissions
- Quiet environment

Focus on getting **text chat working perfectly on mobile first**, then worry about voice!
