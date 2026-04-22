import { useState, useEffect } from 'react';
import { googleAuth } from './auth/GoogleAuth';
import TabNavigation from './components/TabNavigation';
import TokenTimer from './components/TokenTimer';
import DelayDisplay from './components/DelayDisplay';
import PopupBlockedIndicator from './components/PopupBlockedIndicator';
import './App.css';

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    try {
      setError(null);
      console.log('Initializing authentication...');
      
      // Initialize Google Auth
      await googleAuth.init();
      
      // Set up auth state listener
      googleAuth.onAuthStateChanged = (signedIn) => {
        console.log('Auth state changed:', signedIn);
        setIsSignedIn(signedIn);
      };

      // Check if already signed in (from previous session)
      setIsSignedIn(googleAuth.isUserSignedIn());
      
    } catch (err) {
      console.error('Failed to initialize:', err);
      setError(err.message);
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleSignIn() {
    try {
      setError(null);
      await googleAuth.signIn();
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err.message);
    }
  }

  function handleSignOut() {
    googleAuth.signOut();
  }

  // Loading state
  if (isInitializing) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p className="loading-text">Initializing Google Task Manager...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="app-container">
        <div className="error-screen">
          <div className="error-card">
            <h2>⚠️ Initialization Error</h2>
            <p className="error-message">{error}</p>
            <div className="error-actions">
              <button onClick={() => window.location.reload()}>Reload Page</button>
              <a 
                href="https://github.com/Sudain-git/google-task-manager-v2/blob/main/README.md#setup" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <button>View Setup Guide</button>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="app-container">
        <div className="login-screen">
          <div className="login-card">
            <h1>Task Manager V2</h1>
            <p className="tagline">Bulk operations for Google Tasks</p>

            <p className="purpose-statement">
              Task Manager V2 is a free, browser-based tool for performing bulk operations on your Google Tasks.
              Create, update, move, sort, and report on tasks across your lists.
            </p>

            <div className="feature-grid">
              <div className="feature">
                <span className="feature-icon">📝</span>
                <div className="feature-content">
                  <span className="feature-name">Bulk Operations</span>
                  <span className="feature-desc">Insert tasks, set notes and due dates, move, and complete</span>
                </div>
              </div>
              <div className="feature">
                <span className="feature-icon">🌳</span>
                <div className="feature-content">
                  <span className="feature-name">Parent / Child</span>
                  <span className="feature-desc">Build or flatten parent-child task hierarchies</span>
                </div>
              </div>
              <div className="feature">
                <span className="feature-icon">🎥</span>
                <div className="feature-content">
                  <span className="feature-name">Auto Set Notes</span>
                  <span className="feature-desc">Populate YouTube task notes with video metadata or expand YouTube playlists</span>
                </div>
              </div>
              <div className="feature">
                <span className="feature-icon">📊</span>
                <div className="feature-content">
                  <span className="feature-name">Inspect & Report</span>
                  <span className="feature-desc">Browse and filter raw task data, with heatmaps, timelines, and charts</span>
                </div>
              </div>
            </div>

            <button className="primary sign-in-button" onClick={handleSignIn}>
              Sign in with Google
            </button>

            <div className="privacy-notice">
              <p>
                This app requires access to your Tasks list.  An optional, secondary login may be used if you wish to retreive YouTube channel names.
                <br />
                <br />
                This tool runs 100% locally. We never see, collect, or store your data.
              </p>
              <p className="legal-links">
                <a href="https://sudain-git.github.io/google-task-manager-v2/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                {' | '}
                <a href="https://sudain-git.github.io/google-task-manager-v2/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Signed in - show main app
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">Task Manager V2</h1>
          <div className="header-actions">
            <DelayDisplay />
            <PopupBlockedIndicator />
            <TokenTimer />
            <button onClick={handleSignOut} className="sign-out-button">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <TabNavigation />
      </main>

      <footer className="app-footer">
        <p>
          Built with Claude · 
          <a 
            href="https://github.com/Sudain-git/google-task-manager-v2" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
