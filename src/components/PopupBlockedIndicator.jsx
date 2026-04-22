import { useState, useEffect } from 'react';
import { googleAuth } from '../auth/GoogleAuth';
import './TokenTimer.css';

function PopupBlockedIndicator() {
  const [blocked, setBlocked] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    googleAuth.onPopupBlockedChange = (isBlocked) => setBlocked(isBlocked);

    const interval = setInterval(() => {
      setExpired(googleAuth.getRemainingTime() <= 0);
    }, 1000);

    return () => {
      googleAuth.onPopupBlockedChange = null;
      clearInterval(interval);
    };
  }, []);

  if (!blocked || !expired) return null;

  return (
    <div className="token-timer expired">
      <span className="timer-label">Re-Authentication Popup Blocked</span>
    </div>
  );
}

export default PopupBlockedIndicator;
