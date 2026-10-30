# Chronos Deployment & App Installation Guide

This guide covers:
1. **Installing Chronos as a Native Desktop (PC) & Mobile App**
2. **Pushing to GitHub**
3. **Deploying on Render for Free**

---

## 1. Install Chronos as a Desktop (PC) or Mobile App

Chronos is built with full **Progressive Web App (PWA)** support, offline caching, and native OS notifications.

### On PC (Windows / Mac / Linux):
1. Open Chronos in **Google Chrome** or **Microsoft Edge**: [http://localhost:5174](http://localhost:5174)
2. Look at the right side of the address bar:
   - Click the **Install** icon (desktop screen with a downward arrow or **⊕** icon).
   - Alternatively, click the **"Install PC App"** button right inside Chronos in the sidebar or Settings.
3. Click **Install**.
4. **Done!** Chronos is now installed as a native Windows desktop app:
   - Has its own window without browser tabs or URL bars.
   - Pinned to your Windows Taskbar and Start Menu.
   - Plays harmonic chime alarms and sends native Windows alerts!

### On Mobile (iOS / Android):
1. Open Chronos in **Safari** (iPhone) or **Chrome** (Android).
2. **iPhone (iOS)**: Tap the **Share** button (box with upward arrow) → Tap **"Add to Home Screen"**.
3. **Android**: Tap the **⋮** menu → Tap **"Install App"** or **"Add to Home Screen"**.
4. Chronos will launch fullscreen just like a native App Store / Play Store application.

---

## 2. Pushing Chronos to GitHub

If you don't have a GitHub account yet:
1. Go to [https://github.com](https://github.com) and click **Sign Up** (it's free).
2. Once signed in, click the **`+`** icon in the top-right corner → **New repository**.
3. Name it `chronos` (or `chronos-schedule-alarms`).
4. Keep it **Public** (or Private) and leave "Initialize with README" unchecked.
5. Click **Create repository**.
6. Copy your repository URL, e.g., `https://github.com/YOUR_USERNAME/chronos.git`.

### In your terminal / command prompt, run:
```bash
cd "c:\Users\NEW\Desktop\Chronos"
git remote add origin https://github.com/YOUR_USERNAME/chronos.git
git branch -M main
git push -u origin main
```

*(Note: The git repository is already initialized and committed locally with all Chronos source files and `render.yaml`!)*

---

## 3. Deploying to Render (Free Web Service)

Render automatically builds and hosts Vite/React apps with free SSL.

1. Go to [https://render.com](https://render.com) and sign in (you can sign in with your GitHub account).
2. Click **New +** in the top right → Select **Static Site** (or **Blueprint**).
3. Connect your `chronos` GitHub repository.
4. Render will auto-detect settings from `render.yaml`, or fill them in:
   - **Name**: `chronos`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
5. Click **Create Static Site**.
6. In ~1 minute, Render will give you a live HTTPS URL (e.g. `https://chronos-xxxx.onrender.com`).
7. Anyone (including you on your phone or PC) can now visit that URL and click **Install App** to have it on their devices!
