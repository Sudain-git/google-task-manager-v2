# Google Task Manager V2 - Setup Guide

## Part 1: Google Cloud Project Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Project name: `Google Task Manager V2`
4. Click "Create"
5. Wait for project creation, then select it

### Step 2: Enable Google Tasks API

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for "Google Tasks API"
3. Click on it and click **Enable**
4. Wait for API to be enabled

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (unless you have a Google Workspace)
3. Click **Create**

**Fill out the form:**
- **App name:** `Google Task Manager V2`
- **User support email:** [Your email]
- **App logo:** (Optional - skip for now)
- **Application home page:** `https://sudain.github.io/google-task-manager-v2/`
- **Authorized domains:** Add `sudain.github.io`
- **Developer contact information:** [Your email]

4. Click **Save and Continue**

**Scopes page:**
5. Click **Add or Remove Scopes**
6. Filter/search for "Google Tasks API"
7. Select these scopes:
   - `https://www.googleapis.com/auth/tasks` (View and manage your tasks)
   - `https://www.googleapis.com/auth/tasks.readonly` (View your tasks)
8. Click **Update** → **Save and Continue**

**Test users page:**
9. Click **Add Users**
10. Add your Google email address (and any other test users)
11. Click **Save and Continue**

**Summary page:**
12. Review and click **Back to Dashboard**

### Step 4: Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Google Task Manager V2 - Web Client`

**Authorized JavaScript origins:**
5. Click **Add URI** and add:
   - `https://sudain.github.io`

**Authorized redirect URIs:**
6. Click **Add URI** and add:
   - `https://sudain.github.io/google-task-manager-v2/`

7. Click **Create**
8. **IMPORTANT:** Copy your **Client ID** - you'll need this!
   - It looks like: `123456789-abc123def456.apps.googleusercontent.com`
9. Click **OK**

### Step 5: Save Your Client ID

Create a file called `.env.local` in your project root (we'll create this in the next step) and add:

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here
```

**Security Note:** 
- The Client ID is meant to be public and will be visible in your code
- Never commit API secrets or service account keys (we're not using those)
- The redirect URL restrictions keep your app secure
- Users authenticate with their own Google accounts

---

## Part 2: Local Development Setup

### Prerequisites
- Node.js (v18 or higher)
- Git
- VS Code
- GitHub account

### Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click **New repository**
3. Repository name: `google-task-manager-v2`
4. Description: `Bulk Google Tasks management tool`
5. Select **Public**
6. Check **Add a README file**
7. Click **Create repository**

### Clone and Setup

```bash
# Clone your repository
git clone https://github.com/Sudain/google-task-manager-v2.git
cd google-task-manager-v2

# The project files will be added in the next step
```

---

## Part 3: Project Files

After running the setup, you'll have this structure:

```
google-task-manager-v2/
├── .env.local              # Your Client ID (DO NOT COMMIT)
├── .gitignore              # Git ignore file
├── index.html              # Entry point
├── package.json            # Dependencies
├── vite.config.js          # Vite configuration
├── README.md               # Project documentation
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Main app component
    ├── index.css           # Global styles
    ├── auth/
    │   └── GoogleAuth.js   # OAuth implementation
    ├── components/
    │   ├── TabNavigation.jsx
    │   └── tabs/
    │       ├── BulkInsert.jsx
    │       ├── BulkSetNotes.jsx
    │       ├── BulkSetDates.jsx
    │       ├── BulkMove.jsx
    │       ├── BulkComplete.jsx
    │       ├── ParentChild.jsx
    │       ├── AutoSetNotes.jsx
    │       ├── YouTubeImport.jsx
    │       └── Settings.jsx
    └── utils/
        ├── taskApi.js      # Google Tasks API wrapper
        └── duplicateDetector.js
```

---

## Next Steps

1. Complete Google Cloud setup above
2. Create GitHub repository
3. Clone repository locally
4. Open in VS Code
5. Continue with Claude Code to add project files and start development

---

## Security Checklist ✓

- [ ] OAuth consent screen configured
- [ ] Scopes limited to Tasks API only
- [ ] Redirect URLs restricted to your GitHub Pages domain
- [ ] Client ID stored in .env.local (not committed to git)
- [ ] .gitignore includes .env.local
- [ ] Using client-side OAuth (no secrets in code)
- [ ] Test users added for development

---

## Troubleshooting

### "Access blocked: This app's request is invalid"
- Check that your redirect URI exactly matches what's configured in Google Cloud Console
- Ensure you added your email as a test user
- Verify the OAuth consent screen is published or in testing mode

### "Error 400: redirect_uri_mismatch"
- Double-check the redirect URI in Google Cloud Console
- Make sure there are no trailing slashes differences
- For local development, you may need to add `http://localhost:5173` temporarily

### Can't enable Google Tasks API
- Make sure you've selected the correct project in the console
- Wait a few minutes after project creation before enabling APIs

---

## Resources

- [Google Tasks API Documentation](https://developers.google.com/tasks)
- [OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [Google API JavaScript Client](https://github.com/google/google-api-javascript-client)
