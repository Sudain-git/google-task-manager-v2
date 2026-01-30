# Quick Start Guide - Google Task Manager V2

This guide will get you from zero to deployed in about 15 minutes.

## Overview

You'll complete these steps:
1. ✓ Set up Google Cloud Project (5 min)
2. ✓ Create GitHub Repository (2 min)
3. ✓ Set up local development (3 min)
4. ✓ Deploy to GitHub Pages (5 min)

---

## Step 1: Google Cloud Setup

### A. Create Project & Enable API

1. Go to https://console.cloud.google.com/
2. Click "New Project"
   - Name: `Google Task Manager V2`
   - Click "Create"
3. Go to "APIs & Services" → "Library"
4. Search "Google Tasks API" → Click it → Click "Enable"

### B. Configure OAuth

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" → Create
3. Fill in:
   - **App name**: `Google Task Manager V2`
   - **User support email**: [your email]
   - **Developer contact**: [your email]
   - Click "Save and Continue"
4. Click "Add or Remove Scopes"
   - Search for "Google Tasks API"
   - Select both scopes
   - Click "Update" → "Save and Continue"
5. Click "Add Users"
   - Add your email
   - Click "Save and Continue"
6. Click "Back to Dashboard"

### C. Create Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Web application"
4. Name: `Google Task Manager V2 - Web Client`
5. **Authorized JavaScript origins**:
   - Add: `https://sudain.github.io`
6. **Authorized redirect URIs**:
   - Add: `https://sudain.github.io/google-task-manager-v2/`
7. Click "Create"
8. **COPY YOUR CLIENT ID** (looks like `123-abc.apps.googleusercontent.com`)

---

## Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `google-task-manager-v2`
3. Description: `Bulk Google Tasks management tool`
4. Public repository
5. Check "Add a README file"
6. Click "Create repository"

---

## Step 3: Local Setup

### A. Clone and Setup Project

```bash
# Clone the repository
git clone https://github.com/Sudain/google-task-manager-v2.git
cd google-task-manager-v2

# Copy all project files from the provided ZIP/folder into this directory
# The structure should match the files you received

# Install dependencies
npm install
```

### B. Configure Your Client ID

1. Copy `.env.local.template` to `.env.local`:
   ```bash
   cp .env.local.template .env.local
   ```

2. Edit `.env.local` and replace with your Client ID:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-actual-client-id-here.apps.googleusercontent.com
   ```

### C. Test Locally

```bash
npm run dev
```

Open http://localhost:5173 and test:
- Click "Sign in with Google"
- Grant permissions
- Try the "Bulk Insert" tab

---

## Step 4: Deploy to GitHub Pages

### A. Install gh-pages

```bash
npm install --save-dev gh-pages
```

### B. Build and Deploy

```bash
# Build the production version
npm run build

# Deploy to GitHub Pages
npm run deploy
```

This creates a `gh-pages` branch and pushes your app.

### C. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" → "Pages"
3. Under "Source":
   - Select "Deploy from a branch"
   - Branch: `gh-pages`
   - Folder: `/ (root)`
4. Click "Save"
5. Wait 1-2 minutes for deployment

### D. Access Your App

Your app will be live at:
```
https://sudain.github.io/google-task-manager-v2/
```

---

## Troubleshooting

### "Access blocked: This app's request is invalid"
- Add your email to test users in Google Cloud Console
- Check redirect URI exactly matches: `https://sudain.github.io/google-task-manager-v2/`

### "redirect_uri_mismatch"
- Verify the redirect URI in Google Cloud Console
- Make sure there's a trailing slash: `/google-task-manager-v2/`

### Local development OAuth errors
You may need to add `http://localhost:5173` to your authorized origins temporarily for local testing.

---

## Next Steps

✅ **Phase 1 Complete!** You now have:
- Working authentication
- Bulk Insert functionality
- Professional UI

**Ready for Phase 2?** Use Claude Code in VS Code to add:
1. Bulk Set Notes
2. Bulk Set Dates
3. Bulk Move
4. etc.

---

## File Structure Reference

```
google-task-manager-v2/
├── .env.local              # Your Client ID (create this)
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── SETUP_GUIDE.md
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── App.css
    ├── index.css
    ├── auth/
    │   └── GoogleAuth.js
    ├── components/
    │   ├── TabNavigation.jsx
    │   ├── TabNavigation.css
    │   └── tabs/
    │       ├── BulkInsert.jsx
    │       ├── BulkSetNotes.jsx
    │       └── ... (other tabs)
    └── utils/
        ├── taskApi.js
        └── duplicateDetector.js
```

---

## Commands Reference

```bash
# Development
npm run dev          # Start dev server

# Deployment  
npm run build        # Build for production
npm run deploy       # Deploy to GitHub Pages
npm run preview      # Preview production build locally

# Fresh deploy (if needed)
rm -rf dist
npm run build
npm run deploy
```

---

Good luck! 🚀
