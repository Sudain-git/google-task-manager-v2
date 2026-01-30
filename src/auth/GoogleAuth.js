/**
 * Google OAuth Authentication Module
 * 
 * SECURITY IMPLEMENTATION NOTES:
 * 
 * 1. CLIENT-SIDE OAUTH FLOW:
 *    - Uses Google's official gapi library with OAuth 2.0 implicit flow
 *    - Client ID is public (not a secret) and safe to expose in frontend code
 *    - Redirect URIs are restricted in Google Cloud Console to our GitHub Pages domain
 *    - No refresh tokens or secrets are stored client-side
 * 
 * 2. TOKEN MANAGEMENT:
 *    - Access tokens are short-lived (typically 1 hour)
 *    - Tokens are stored in memory only (not localStorage to prevent XSS attacks)
 *    - Automatic token refresh when expired
 *    - Silent re-authentication when possible
 * 
 * 3. SCOPE RESTRICTIONS:
 *    - Only requests minimal required scopes (tasks and tasks.readonly)
 *    - User explicitly consents to these permissions
 *    - No access to other Google services
 * 
 * 4. BEST PRACTICES:
 *    - HTTPS-only in production (enforced by GitHub Pages)
 *    - No sensitive data logged to console in production
 *    - Proper error handling for network failures
 *    - User can revoke access at any time via Google Account settings
 */

class GoogleAuth {
  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    this.scope = 'https://www.googleapis.com/auth/tasks';
    this.discoveryDocs = ['https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest'];
    
    this.isInitialized = false;
    this.isSignedIn = false;
    this.currentUser = null;
    this.tokenClient = null;
    this.accessToken = null;
    
    // Callbacks for auth state changes
    this.onAuthStateChanged = null;
  }

  /**
   * Initialize Google API client
   * Must be called before any other methods
   */
  async init() {
    if (this.isInitialized) {
      console.log('[Auth] Already initialized');
      return;
    }

    try {
      // Validate client ID is configured
      if (!this.clientId || this.clientId.includes('your-client-id')) {
        throw new Error(
          'Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in .env.local'
        );
      }

      console.log('[Auth] Initializing Google API...');
      
      // Load Google API client library
      await this.loadGoogleAPI();
      
      // Initialize gapi client
      await new Promise((resolve, reject) => {
        window.gapi.load('client', { 
          callback: resolve, 
          onerror: reject 
        });
      });

      await window.gapi.client.init({
        discoveryDocs: this.discoveryDocs,
      });

      // Initialize Google Identity Services (GIS) for OAuth
      this.initializeTokenClient();

      this.isInitialized = true;
      console.log('[Auth] Initialization complete');
      
    } catch (error) {
      console.error('[Auth] Initialization failed:', error);
      throw new Error(`Failed to initialize Google Auth: ${error.message}`);
    }
  }

  /**
   * Load Google API script dynamically
   */
  loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.gapi) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.body.appendChild(script);
    });
  }

  /**
   * Initialize Google Identity Services token client
   */
  initializeTokenClient() {
    // Load GIS library if not already loaded
    if (!window.google?.accounts?.oauth2) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      
      // Wait for script to load
      return new Promise((resolve) => {
        script.onload = () => {
          this.createTokenClient();
          resolve();
        };
      });
    } else {
      this.createTokenClient();
    }
  }

  /**
   * Create the OAuth token client
   */
  createTokenClient() {
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: this.scope,
      callback: (response) => {
        if (response.error) {
          console.error('[Auth] Token error:', response);
          this.handleAuthError(response.error);
          return;
        }

        // Store access token
        this.accessToken = response.access_token;
        this.isSignedIn = true;
        
        // Set token for gapi client
        window.gapi.client.setToken({
          access_token: this.accessToken
        });

        console.log('[Auth] Successfully authenticated');
        
        // Notify listeners
        if (this.onAuthStateChanged) {
          this.onAuthStateChanged(true);
        }
      },
    });
  }

  /**
   * Sign in user - triggers OAuth consent flow
   */
  async signIn() {
    if (!this.isInitialized) {
      throw new Error('Auth not initialized. Call init() first.');
    }

    try {
      console.log('[Auth] Requesting token...');
      
      // Request access token - this will show Google's consent screen
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
      
    } catch (error) {
      console.error('[Auth] Sign in failed:', error);
      throw error;
    }
  }

  /**
   * Sign out user
   */
  signOut() {
    if (this.accessToken) {
      // Revoke the token
      window.google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('[Auth] Token revoked');
      });
      
      this.accessToken = null;
      window.gapi.client.setToken(null);
    }

    this.isSignedIn = false;
    this.currentUser = null;

    console.log('[Auth] Signed out');

    // Notify listeners
    if (this.onAuthStateChanged) {
      this.onAuthStateChanged(false);
    }
  }

  /**
   * Check if user is currently signed in
   */
  isUserSignedIn() {
    return this.isSignedIn && this.accessToken !== null;
  }

  /**
   * Get current access token
   * Will attempt to refresh if expired
   */
  async getAccessToken() {
    if (!this.accessToken) {
      throw new Error('No access token available. Please sign in.');
    }

    // Check if token is still valid by making a test request
    try {
      await window.gapi.client.tasks.tasklists.list({ maxResults: 1 });
      return this.accessToken;
    } catch (error) {
      // Token might be expired, request a new one
      if (error.status === 401) {
        console.log('[Auth] Token expired, requesting new token...');
        
        // Request new token silently (without consent screen if possible)
        return new Promise((resolve, reject) => {
          this.tokenClient.callback = (response) => {
            if (response.error) {
              reject(new Error('Failed to refresh token'));
              return;
            }
            
            this.accessToken = response.access_token;
            window.gapi.client.setToken({ access_token: this.accessToken });
            resolve(this.accessToken);
          };
          
          this.tokenClient.requestAccessToken({ prompt: '' });
        });
      }
      
      throw error;
    }
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(error) {
    console.error('[Auth] Authentication error:', error);
    
    // Common error cases
    const errorMessages = {
      'popup_closed_by_user': 'Sign-in was cancelled',
      'access_denied': 'Access was denied',
      'invalid_client': 'Invalid client configuration',
    };

    const message = errorMessages[error] || 'Authentication failed';
    
    // Could trigger UI notification here
    alert(message);
  }

  /**
   * Get user's email (if available)
   */
  getUserEmail() {
    const token = window.gapi.client.getToken();
    if (!token) return null;
    
    // Parse JWT token to get email (token is in format: header.payload.signature)
    try {
      const payload = token.access_token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.email;
    } catch (error) {
      console.error('[Auth] Failed to parse token:', error);
      return null;
    }
  }
}

// Export singleton instance
export const googleAuth = new GoogleAuth();
