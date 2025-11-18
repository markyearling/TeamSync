# TeamSnap OAuth Setup for Mobile (iOS & Android)

This document explains the configuration needed to make TeamSnap OAuth work on mobile devices using Universal Links (iOS) and App Links (Android).

## Overview

TeamSnap requires HTTPS-based redirect URIs. On mobile, we use:
- **iOS**: Universal Links to intercept HTTPS URLs
- **Android**: App Links to intercept HTTPS URLs

When TeamSnap redirects to `https://sprightly-lebkuchen-6e85b6.netlify.app/connections/teamsnap/callback?code=...`, the mobile app will intercept this URL and handle the OAuth callback.

## Files Modified

### 1. iOS Configuration (`ios/App/App/Info.plist`)
Added:
- `CFBundleURLTypes`: Custom URL scheme `famsink://` as a fallback
- `com.apple.developer.associated-domains`: Universal Links for your Netlify domain

### 2. Android Configuration (`android/app/src/main/AndroidManifest.xml`)
Added two intent-filters:
- HTTPS App Links for your Netlify domain (with autoVerify)
- Custom scheme `famsink://` as a fallback

### 3. Universal Links Verification Files
Created in `/public/.well-known/`:
- `apple-app-site-association`: For iOS Universal Links
- `assetlinks.json`: For Android App Links (requires SHA-256 fingerprint)

### 4. Deep Link Handling (`src/App.tsx`)
Added Capacitor App plugin listener to handle incoming URLs and navigate to the appropriate route.

## Setup Steps

### For iOS

1. **Deploy the Universal Links file**:
   ```bash
   npm run build
   npx cap sync
   ```

   The `apple-app-site-association` file will be served at:
   `https://sprightly-lebkuchen-6e85b6.netlify.app/.well-known/apple-app-site-association`

2. **Test Universal Links**:
   - The file must be accessible without authentication
   - Verify it returns JSON (not HTML)
   - Use Apple's AASA Validator: https://branch.io/resources/aasa-validator/

3. **Build and deploy to device**:
   ```bash
   npm run cap:build
   npx cap open ios
   ```

   In Xcode:
   - Go to Signing & Capabilities
   - Ensure "Associated Domains" capability is added
   - Verify the domain is: `applinks:sprightly-lebkuchen-6e85b6.netlify.app`
   - Build and run on a physical device (Universal Links don't work in simulator)

### For Android

1. **Generate SHA-256 Certificate Fingerprint**:

   For debug builds:
   ```bash
   cd android
   ./gradlew signingReport
   ```

   For production builds (you'll need your keystore):
   ```bash
   keytool -list -v -keystore /path/to/your/keystore.jks -alias your-key-alias
   ```

   Copy the SHA-256 fingerprint (format: `AA:BB:CC:...`)

2. **Update assetlinks.json**:
   Edit `/public/.well-known/assetlinks.json` and replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with your actual SHA-256 (remove colons):
   ```json
   {
     "sha256_cert_fingerprints": [
       "AABBCCDD..."
     ]
   }
   ```

3. **Deploy and verify**:
   ```bash
   npm run build
   ```

   Verify the file is accessible at:
   `https://sprightly-lebkuchen-6e85b6.netlify.app/.well-known/assetlinks.json`

   Test with Google's Digital Asset Links checker:
   https://developers.google.com/digital-asset-links/tools/generator

4. **Build and deploy to device**:
   ```bash
   npm run cap:build
   npx cap open android
   ```

   In Android Studio:
   - Build and run on a physical device
   - App Links work best on real devices, not emulators

## Testing OAuth Flow

### On iOS:
1. Open the app
2. Navigate to Connections → TeamSnap
3. Click "Connect TeamSnap Account"
4. You'll be redirected to TeamSnap's login page (in Safari or in-app browser)
5. After logging in, TeamSnap redirects to: `https://sprightly-lebkuchen-6e85b6.netlify.app/connections/teamsnap/callback?code=...`
6. iOS recognizes this as a Universal Link and opens your app
7. The app's deep link handler catches this and navigates to the callback route
8. The callback route processes the OAuth code and completes authentication

### On Android:
Same flow as iOS, but uses Android App Links instead of Universal Links.

## Troubleshooting

### iOS Universal Links Not Working:

1. **Check file accessibility**: Ensure `apple-app-site-association` is served with correct Content-Type:
   ```bash
   curl -I https://sprightly-lebkuchen-6e85b6.netlify.app/.well-known/apple-app-site-association
   ```
   Should return: `Content-Type: application/json`

2. **Verify app ID**: The appID in the file should match your bundle ID from Xcode
   Currently set to: `com.yearling.famsink`

3. **Test on physical device**: Universal Links don't work in iOS Simulator

4. **Clear Universal Links cache**:
   - Uninstall the app
   - Restart the device
   - Reinstall the app

5. **Check Associated Domains in Xcode**:
   - Open project in Xcode
   - Select target → Signing & Capabilities
   - Ensure "Associated Domains" capability exists
   - Verify domain: `applinks:sprightly-lebkuchen-6e85b6.netlify.app`

### Android App Links Not Working:

1. **Verify Digital Asset Links**:
   ```bash
   curl https://sprightly-lebkuchen-6e85b6.netlify.app/.well-known/assetlinks.json
   ```

2. **Check SHA-256 fingerprint**: Must match exactly (no colons, all uppercase)

3. **Test App Links**: Use adb to test:
   ```bash
   adb shell am start -a android.intent.action.VIEW -d "https://sprightly-lebkuchen-6e85b6.netlify.app/connections/teamsnap/callback?code=test"
   ```

4. **Check AndroidManifest**: Ensure `android:autoVerify="true"` is set on the intent-filter

5. **Reset App Links settings**:
   ```bash
   adb shell pm set-app-links --package com.yearling.famsink 0 all
   adb shell pm verify-app-links --re-verify com.yearling.famsink
   ```

### OAuth Still Not Working:

1. **Check TeamSnap Developer Portal**:
   - Verify redirect URI is exactly: `https://sprightly-lebkuchen-6e85b6.netlify.app/connections/teamsnap/callback`
   - Check client ID and client secret match your `.env` file

2. **Check app logs**:
   - iOS: Xcode console
   - Android: Android Studio Logcat
   - Look for `[Deep Link]` prefixed messages

3. **Test on web first**: Verify OAuth works on web version before testing mobile

## Additional Notes

- Universal Links/App Links require HTTPS - they won't work with HTTP or localhost
- The domain must be publicly accessible for verification to work
- Changes to the verification files may take up to 24 hours to propagate
- Always test on physical devices, not emulators/simulators
- The first time a user installs the app, they may need to restart it for Universal Links/App Links to work

## Custom Scheme Fallback

If Universal Links/App Links fail, the app also registers a custom scheme `famsink://` as a fallback. However, TeamSnap must support this redirect URI format, which is unlikely. This is mainly for future use or other OAuth providers.

## Next Steps

1. Generate Android SHA-256 certificate fingerprint
2. Update `/public/.well-known/assetlinks.json` with the fingerprint
3. Deploy the changes to Netlify
4. Build and test on physical devices
5. Verify Universal Links/App Links with platform-specific tools
