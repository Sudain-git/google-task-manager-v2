import { useState, useEffect, useRef } from 'react';
import { googleAuth } from '../auth/GoogleAuth';
import './TokenTimer.css';

function TokenTimer() {
  const [remainingTime, setRemainingTime] = useState(0);
  const [status, setStatus] = useState('good');
  const refreshTriggered = useRef(false);
  const retryCount = useRef(0);
  const retryTimeout = useRef(null);

  useEffect(() => {
    // Reset refresh flag when effect runs
    refreshTriggered.current = false;

    // Update timer every second
    const interval = setInterval(() => {
      const remaining = googleAuth.getRemainingTime();
      setRemainingTime(remaining);

      // Update status based on remaining time (production values)
      if (remaining > 600) { // > 10 minutes
        setStatus('good');
      } else if (remaining > 300) { // 5-10 minutes
        setStatus('warning');
      } else if (remaining > 0) { // < 5 minutes
        setStatus('critical');
      } else {
        setStatus('expired');
      }

      // Auto-refresh at 5 minutes remaining (only trigger once per cycle)
      if (remaining <= 300 && remaining > 0 && !refreshTriggered.current) {
        refreshTriggered.current = true;
        retryCount.current = 0; // Reset retry count
        handleAutoRefresh();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current);
      }
    };
  }, []);

  async function handleAutoRefresh() {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 60000; // 60 seconds in milliseconds

    try {
      console.log(`[TokenTimer] Auto-refreshing token (attempt ${retryCount.current + 1}/${MAX_RETRIES})...`);
      await googleAuth.refreshToken();
      
      // Success! Reset everything
      console.log('[TokenTimer] Token refresh successful');
      refreshTriggered.current = false;
      retryCount.current = 0;
      
      // // COMMENTED OUT: Show success notification
      // alert('Session refreshed! You have another hour.');
      
    } catch (error) {
      console.error(`[TokenTimer] Refresh attempt ${retryCount.current + 1} failed:`, error);
      retryCount.current++;

      if (retryCount.current < MAX_RETRIES) {
        // Schedule retry after 60 seconds
        console.log(`[TokenTimer] Retrying in 60 seconds... (${retryCount.current}/${MAX_RETRIES} attempts used)`);
        
        retryTimeout.current = setTimeout(() => {
          handleAutoRefresh();
        }, RETRY_DELAY);
        
      } else {
        // All retries exhausted
        console.error('[TokenTimer] All refresh attempts failed. Please sign in again.');
        refreshTriggered.current = false;
        retryCount.current = 0;
        
        // // COMMENTED OUT: Show error notification
        // alert('Failed to refresh session after 3 attempts. Please sign in again.');
      }
    }
  }

  function formatTime(seconds) {
    if (seconds <= 0) return 'Expired';
    
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  if (remainingTime <= 0) {
    return (
      <div className="token-timer expired">
        <span className="timer-label">Session:</span>
        <span className="timer-value">Expired</span>
      </div>
    );
  }

  return (
    <div className={`token-timer ${status}`}>
      <span className="timer-label">Session:</span>
      <span className="timer-value">{formatTime(remainingTime)}</span>
    </div>
  );
}

export default TokenTimer;