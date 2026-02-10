import { useState, useEffect, useRef } from 'react';
import { googleAuth } from '../auth/GoogleAuth';
import './TokenTimer.css';

function TokenTimer() {
  const [remainingTime, setRemainingTime] = useState(0);
  const [status, setStatus] = useState('good');
  const hasRefreshed = useRef(false); // Track if we've already refreshed once

  useEffect(() => {
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

      // Auto-refresh at 5 minutes remaining (only once)
      if (remaining <= 300 && remaining > 0 && !hasRefreshed.current) {
        hasRefreshed.current = true;
        handleAutoRefresh();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  async function handleAutoRefresh() {
    try {
      console.log('[TokenTimer] Auto-refreshing token (one-time attempt)...');
      await googleAuth.refreshToken();

      console.log('[TokenTimer] Token refresh successful');

      // Force component to re-read the new expiration time
      setRemainingTime(googleAuth.getRemainingTime());
      hasRefreshed.current = false; // Reset so auto-refresh can trigger again next cycle

      // // COMMENTED OUT: Show success notification
      // alert('Session refreshed! You have another hour.');

    } catch (error) {
      console.error('[TokenTimer] Token refresh failed:', error);

      // // COMMENTED OUT: Show error notification
      // alert('Failed to refresh session. Please sign in again.');
    }
  }

  async function handleManualRefresh() {
    console.log('[TokenTimer] ========== MANUAL REFRESH STARTED ==========');
    console.log('[TokenTimer] Current remaining time:', remainingTime, 'seconds');
    console.log('[TokenTimer] Token expires at:', googleAuth.getTokenExpiresAt()
      ? new Date(googleAuth.getTokenExpiresAt()).toLocaleString() : 'N/A');

    try {
      console.log('[TokenTimer] Calling googleAuth.refreshToken()...');
      await googleAuth.refreshToken();

      const newRemaining = googleAuth.getRemainingTime();
      console.log('[TokenTimer] Refresh successful!');
      console.log('[TokenTimer] New remaining time:', newRemaining, 'seconds');
      console.log('[TokenTimer] New expiration:', new Date(googleAuth.getTokenExpiresAt()).toLocaleString());

      setRemainingTime(newRemaining);
      hasRefreshed.current = false; // Reset so auto-refresh can happen again

      console.log('[TokenTimer] ========== MANUAL REFRESH COMPLETE ==========');
    } catch (error) {
      console.error('[TokenTimer] ========== MANUAL REFRESH FAILED ==========');
      console.error('[TokenTimer] Error:', error.message);
      console.error('[TokenTimer] Full error:', error);
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
      <div
        className="token-timer expired"
        onClick={handleManualRefresh}
        title="Click to refresh session"
      >
        <span className="timer-label">Session:</span>
        <span className="timer-value">Expired</span>
      </div>
    );
  }

  return (
    <div
      className={`token-timer ${status}`}
      onClick={handleManualRefresh}
      title="Click to refresh session"
    >
      <span className="timer-label">Session:</span>
      <span className="timer-value">{formatTime(remainingTime)}</span>
    </div>
  );
}

export default TokenTimer;