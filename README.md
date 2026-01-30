# Google Task Manager V2

A powerful web application for managing Google Tasks in bulk, built with React and the Google Tasks API.

![Project Status](https://img.shields.io/badge/status-in%20development-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

### Phase 1: Foundation ✓
- [x] OAuth 2.0 authentication
- [x] Tab-based navigation
- [x] **Bulk Insert**: Insert multiple tasks at once
- [ ] Task list selection

### Phase 2: Core Operations (In Progress)
- [ ] **Bulk Set Notes**: Add notes to multiple tasks
- [ ] **Bulk Set Due Dates**: Set dates with various cadences (same date, daily, weekly, monthly)
- [ ] **Bulk Move**: Move tasks between lists
- [ ] **Bulk Complete**: Mark multiple tasks as complete
- [ ] **Parent/Child Management**: Create hierarchies and flatten structures

### Phase 3: Advanced Features
- [ ] **YouTube Playlist Import**: Convert playlists to tasks
- [ ] **Automatic Set Notes**: Extract YouTube video metadata (runtime, creator, title)
- [ ] **Duplicate Detection**: Filter exact title/note matches
- [ ] **Advanced Rate Limiting**: Dynamic delays for large operations (200-6000 tasks)

## Technology Stack

- **Frontend**: React 18 with Vite
- **Authentication**: Google OAuth 2.0 (client-side)
- **API**: Google Tasks API v1
- **Styling**: Custom CSS with CSS Variables
- **Deployment**: GitHub Pages

## Security

This application implements secure client-side OAuth:
- Client ID is public (not a secret) and safe in frontend code
- Redirect URIs restricted to GitHub Pages domain
- Access tokens stored in memory only (not localStorage)
- Automatic token refresh when expired
- Minimal required scopes (Google Tasks only)

## Getting Started

### Prerequisites

- Node.js 18 or higher
- A Google Cloud project with Tasks API enabled
- GitHub account

### Setup

1. **Follow the Setup Guide**
   
   See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions on:
   - Creating a Google Cloud project
   - Enabling the Tasks API
   - Configuring OAuth consent screen
   - Getting your Client ID

2. **Clone the Repository**

   ```bash
   git clone https://github.com/Sudain/google-task-manager-v2.git
   cd google-task-manager-v2
   ```

3. **Install Dependencies**

   ```bash
   npm install
   ```

4. **Configure Environment**

   Create a `.env.local` file in the project root:

   ```env
   VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   ```

5. **Run Development Server**

   ```bash
   npm run dev
   ```

   Open http://localhost:5173 in your browser.

## Deployment

### GitHub Pages

1. **Update `vite.config.js`** (already configured for this repo)

2. **Build and Deploy**

   ```bash
   npm run build
   npm run deploy
   ```

3. **Configure GitHub Pages**
   
   - Go to your repo Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` / `root`
   - Save

4. **Access Your App**
   
   https://sudain.github.io/google-task-manager-v2/

## Usage

### Bulk Insert

1. Sign in with your Google account
2. Navigate to "Bulk Insert" tab
3. Select a task list
4. Paste task titles (one per line)
5. Click "Insert Tasks"

More features coming in Phase 2!

## Development

### Project Structure

```
src/
├── auth/
│   └── GoogleAuth.js       # OAuth implementation
├── components/
│   ├── TabNavigation.jsx   # Tab navigation component
│   └── tabs/               # Individual tab components
│       ├── BulkInsert.jsx
│       ├── BulkSetNotes.jsx
│       └── ...
├── utils/
│   ├── taskApi.js         # Google Tasks API wrapper
│   └── duplicateDetector.js
├── App.jsx                # Main app component
├── App.css                # App-specific styles
├── index.css              # Global styles
└── main.jsx               # React entry point
```

### Using Claude Code

This project was developed with Claude Code assistance. To continue development:

1. Open the project in VS Code
2. Use Claude Code to work on specific features
3. Test each feature before moving to the next

### Development Workflow

1. Create/update feature in appropriate tab component
2. Test locally with `npm run dev`
3. Commit changes to git
4. Deploy to GitHub Pages with `npm run deploy`

## Contributing

This is a personal project, but suggestions and feedback are welcome! Please open an issue for any bugs or feature requests.

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Built with assistance from Claude (Anthropic)
- Uses Google Tasks API
- Inspired by the need for better bulk task management

---

**Note**: This application is in active development. Features are being added incrementally based on the phased development plan.
