# JellyWave

JellyWave is a premium, beautifully designed desktop music application that connects directly to a Jellyfin server. Built with Electron, Node.js, Express, and SQLite, it offers both a standalone client and an easy-to-host Docker setup.

## Features
- **Premium Homepage & Web Player**: Hosted under a single node process, making deploying a breeze. The homepage operates at `/` while the app operates at `/app`.
- **Cloudflare Ready**: The Express server natively supports `trust proxy`, meaning it's ready to handle secure reverse-proxied traffic immediately.
- **Cross-Platform**: Deploy via Docker for the web iteration, build Windows `.exe` / Linux `.AppImage` via Electron, or wrap the frontend folder simply into Android via Capacitor!

## Quick Start & Setup

### 1. Prerequisites
- Node.js (v18+)
- Jellyfin Server (optional, falls back to demo mode)

### 2. Local Desktop Installation
Clone the project, install dependencies, and start the app:
\`\`\`bash
npm install
cp .env.example .env
npm start
\`\`\`

### 3. Docker Hosting (Web Version)
You can host JellyWave as a web service accessible from the browser:
\`\`\`bash
cp .env.example .env
docker-compose up -d
\`\`\`
Visit \`http://localhost:1075\` to see your app.

## Building Cross-Platform Artifacts
JellyWave is designed to package distribution binaries directly into `homepage/releases`, making them immediately downloadable from your live site!

### Linux and Windows
To compile desktop executables:
\`\`\`bash
npm run build:desktop
\`\`\`
This leverages \`electron-builder\` to generate `.AppImage`, `.snap`, and `.exe` files located in \`homepage/releases/\`. The frontend website download buttons point directly to these files.

### Android
JellyWave uses Capacitor to package the `/frontend` into a native application.
\`\`\`bash
npx cap copy android
npx cap open android
# Then build your signed APK in Android Studio and move it to homepage/releases/JellyWave.apk
\`\`\`

## Environment Configuration
You can prefill system settings by defining them in \`.env\`.
- \`JELLYFIN_URL\`: Full URL to your Jellyfin instance.
- \`JELLYFIN_USERNAME\`: Your Jellyfin username.
- \`JELLYFIN_PASSWORD\`: Your Jellyfin password.
- \`APP_PORT\`: Server exposure port (default 1075).
