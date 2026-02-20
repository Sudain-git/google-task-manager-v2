# Google Task Manager V2

Bulk management tool for Google Tasks. Select tasks, apply operations in batch, and visualize your task data with built-in reports.

**Live app**: https://sudain.github.io/google-task-manager-v2/

**[Privacy Policy](https://sudain.github.io/google-task-manager-v2/privacy.html)** | **[Terms of Service](https://sudain.github.io/google-task-manager-v2/terms.html)**

## Features

### Tabs

| Tab | Description |
|-----|-------------|
| **BulkInsert** | Insert multiple tasks at once (one title per line) |
| **BulkSetNotes** | Set or append notes to multiple tasks |
| **BulkSetDates** | Assign due dates with cadence options (same date, daily, weekly, monthly) |
| **BulkMove** | Move tasks between lists |
| **BulkComplete** | Mark tasks complete or incomplete |
| **ParentChild** | Create/flatten parent-child task hierarchies |
| **AutoSetNotes** | Extract YouTube video metadata (runtime, creator, title) into task notes |
| **Inspect** | View and explore raw task data |
| **ListImport** | Import tasks from external lists |
| **Reports** | Visual reports and charts (see below) |

### Reports

- **DueHeatmap** — Calendar heatmap of task due dates with click-to-select date range
- **DueTimeline** — Timeline chart of due date distribution
- **UpdatedHeatmap** — Calendar heatmap of task update activity
- **ParentChildReport** — Visualization of task hierarchies
- **TaskTimeline** — Timeline of task creation and completion
- **WaffleChart** — Waffle chart of task completion status
- **WordCloud** — Word cloud generated from task titles

## Security

This app runs entirely client-side. There is no backend server.

- **OAuth 2.0**: Users authenticate directly with Google. The app requests only the `tasks` scope.
- **Tokens in memory**: Access tokens are held in JavaScript memory only — never written to localStorage or cookies.
- **No secrets in code**: The OAuth Client ID is a public identifier, not a secret. Redirect URIs are restricted to the GitHub Pages domain.
- **Minimal scopes**: The app only requests access to Google Tasks.

> **"Unverified app" warning**: Because this app uses an external OAuth consent screen that hasn't gone through Google's verification process, new users will see a warning screen. Click "Advanced" then "Go to Google Task Manager V2 (unsafe)" to proceed. This is normal for personal/small projects.

## Setup

### 1. Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** then **New Project**
3. Name it `Google Task Manager V2` and click **Create**

### 2. Enable the Tasks API

1. In the sidebar, go to **APIs & Services** then **Library**
2. Search for **Google Tasks API** and click **Enable**

### 3. Configure the OAuth consent screen

1. Go to **APIs & Services** then **OAuth consent screen**
2. Select **External** and click **Create**
3. Fill in:
   - App name: `Google Task Manager V2`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. On the Scopes page, click **Add or Remove Scopes**, search for `Google Tasks API`, select both scopes, click **Update** then **Save and Continue**
6. On the Test users page, add your Google email, then **Save and Continue**

### 4. Create OAuth credentials

1. Go to **APIs & Services** then **Credentials**
2. Click **Create Credentials** then **OAuth client ID**
3. Application type: **Web application**
4. Name: `Google Task Manager V2 - Web Client`
5. Authorized JavaScript origins: `https://[yourgithub-UsernameHere].github.io`
6. Authorized redirect URIs: `https://[yourgithub-UsernameHere]].github.io/google-task-manager-v2/`
7. Click **Create** and copy the **Client ID**

### 5. Clone and run locally

```bash
git clone https://github.com/Sudain-git/google-task-manager-v2.git
cd google-task-manager-v2
npm install
```

Create `.env.local` in the project root:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

Start the dev server:

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

> For local development, you may need to add `http://localhost:5173` to your authorized JavaScript origins in the Google Cloud Console.

## Deployment

The app auto-deploys to GitHub Pages on every push to `main` via GitHub Actions (see `.github/workflows/deploy.yml`).

To deploy your own fork:

1. Go to your repo **Settings** then **Secrets and variables** then **Actions**
2. Add a repository secret: `VITE_GOOGLE_CLIENT_ID` with your Client ID
3. Push to `main` — the workflow builds and deploys automatically

## Tech stack

- React 18
- Vite
- Google OAuth 2.0 (client-side)
- Google Tasks API v1

## Project structure

```
src/
├── auth/
│   └── GoogleAuth.js            # OAuth implementation
├── components/
│   ├── DelayDisplay.jsx         # Rate-limit delay indicator
│   ├── FetchingIndicator.jsx    # Loading/fetch status
│   ├── TabNavigation.jsx        # Tab navigation
│   ├── TabNavigation.css
│   ├── TokenTimer.jsx           # OAuth token expiry timer
│   ├── TokenTimer.css
│   ├── WaffleChart.jsx          # Waffle chart component
│   ├── WordCloud.jsx            # Word cloud component
│   ├── reports/
│   │   ├── DueHeatmap.jsx
│   │   ├── DueTimelineChart.jsx
│   │   ├── ParentChildReport.jsx
│   │   ├── TaskTimelineChart.jsx
│   │   └── UpdatedHeatmap.jsx
│   └── tabs/
│       ├── AutoSetNotes.jsx
│       ├── BulkComplete.jsx
│       ├── BulkInsert.jsx
│       ├── BulkMove.jsx
│       ├── BulkSetDates.jsx
│       ├── BulkSetNotes.jsx
│       ├── Inspect.jsx
│       ├── ListImport.jsx
│       ├── ParentChild.jsx
│       └── Reports.jsx
├── utils/
│   ├── duplicateDetector.js     # Duplicate task detection
│   ├── taskApi.js               # Google Tasks API wrapper
│   ├── wordCloudLayout.js       # Word cloud layout algorithm
│   └── youtubeApi.js            # YouTube Data API wrapper
├── App.jsx
├── App.css
├── index.css
└── main.jsx
```

## License

[MIT](LICENSE)
