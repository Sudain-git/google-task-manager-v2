import { useState, useEffect } from 'react';
import { taskAPI } from '../utils/taskApi';
import './TokenTimer.css';

function RpsDisplay() {
  const [rps, setRps] = useState(0);

  useEffect(() => {
    taskAPI.onRpsChange = (newRps) => setRps(newRps);
    return () => { taskAPI.onRpsChange = null; };
  }, []);

  if (rps === 0) return null;

  const statusClass = rps >= 8 ? 'critical' : rps >= 3 ? 'good' : 'warning';

  return (
    <div className={`token-timer ${statusClass}`}>
      <span className="timer-label">RPS:</span>
      <span className="timer-value" style={{ minWidth: 'auto' }}>{rps}</span>
    </div>
  );
}

export default RpsDisplay;
