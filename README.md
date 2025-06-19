# TeamSync

A comprehensive sports schedule management app for families.

## Features

- 📅 **Calendar Management** - View and manage children's sports schedules
- 👥 **Profile Management** - Create profiles for each child with sports and activities
- 🔗 **Platform Integration** - Connect with TeamSnap, Playmetrics, and other sports platforms
- 💬 **Friends & Messaging** - Connect with other parents and share schedules
- 📱 **Mobile Apps** - Native iOS and Android apps via Capacitor
- 🔔 **Push Notifications** - Stay updated with schedule changes and messages

## Development

### Web Development
```bash
npm install
npm run dev
```

### Mobile Development

#### Prerequisites
- Node.js 18+
- iOS: Xcode 14+ and iOS 13+
- Android: Android Studio and Android API 22+

#### Setup Mobile Development
```bash
# Install dependencies
npm install

# Build the web app
npm run build

# Initialize Capacitor (first time only)
npx cap init

# Add platforms (first time only)
npx cap add ios
npx cap add android

# Sync web assets to native projects
npx cap sync
```

#### iOS Development
```bash
# Open in Xcode
npm run cap:ios

# Or run with live reload
npm run cap:serve
```

#### Android Development
```bash
# Open in Android Studio
npm run cap:android

# Or run with live reload
npm run cap:serve:android
```

### Building for Production

#### Web
```bash
npm run build
```

#### Mobile Apps
1. Build the web app: `npm run build`
2. Sync to native: `npx cap sync`
3. Open in respective IDEs and build/archive for app stores

## App Store Deployment

### iOS App Store
1. Open project in Xcode
2. Configure signing & capabilities
3. Archive and upload to App Store Connect
4. Submit for review

### Google Play Store
1. Open project in Android Studio
2. Generate signed APK/AAB
3. Upload to Google Play Console
4. Submit for review

## Environment Variables

Create a `.env` file with:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_TEAMSNAP_CLIENT_ID=your-teamsnap-client-id
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Mobile**: Capacitor 5
- **Backend**: Supabase (Database, Auth, Storage)
- **Deployment**: Netlify (Web), App Store & Play Store (Mobile)