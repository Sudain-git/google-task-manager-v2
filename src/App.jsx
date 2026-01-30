import { useState, useEffect } from 'react';
import { googleAuth } from './auth/GoogleAuth';
import TabNavigation from './components/TabNavigation';
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
                href="https://github.com/Sudain/google-task-manager-v2/blob/main/SETUP_GUIDE.md" 
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
            <h1>Google Task Manager V2</h1>
            <p className="tagline">Bulk operations for Google Tasks</p>
            
            <div className="feature-grid">
              <div className="feature">
                <span className="feature-icon">📝</span>
                <span>Bulk Insert</span>
              </div>
              <div className="feature">
                <span className="feature-icon">📅</span>
                <span>Set Due Dates</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🎥</span>
                <span>YouTube Import</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🔗</span>
                <span>Parent/Child</span>
              </div>
            </div>

            <button className="primary sign-in-button" onClick={handleSignIn}>
              Sign in with Google
            </button>

            <div className="privacy-notice">
              <p>
                This app requires access to your Google Tasks.
                Your data is never stored on our servers.
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
          <button onClick={handleSignOut} className="sign-out-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="app-main">
        <TabNavigation />
      </main>

      <footer className="app-footer">
        <p>
          Built with Claude · 
          <a 
            href="https://github.com/Sudain/google-task-manager-v2" 
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
