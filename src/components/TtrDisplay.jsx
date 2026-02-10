import { useState, useEffect, useRef } from 'react';
import { taskAPI } from '../utils/taskApi';
import './TokenTimer.css';

function TtrDisplay() {
  const [state, setState] = useState(null); // null | { recovering, since } | { recovering, duration }
  const [elapsed, setElapsed] = useState(0);
  const [prevDuration, setPrevDuration] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    taskAPI.onTtrChange = (value) => {
      setState(prev => {
        // When a new recovery starts, save the last completed duration as previous
        if (value?.recovering && prev && !prev.recovering && prev.duration != null) {
          setPrevDuration(prev.duration);
        }
        // Bulk op ended — reset previous
        if (value === null) {
          setPrevDuration(null);
        }
        return value;
      });
    };
    return () => { taskAPI.onTtrChange = null; };
  }, []);

  // Live counter when recovering
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (state?.recovering) {
      const tick = () => {
        const secs = (Date.now() - taskAPI._recoveryStartTime) / 1000;
        setElapsed(Math.round(secs * 10) / 10);
      };
      tick();
      intervalRef.current = setInterval(tick, 100);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state]);

  if (!state) return null;

  const prevSuffix = prevDuration != null ? `/${prevDuration.toFixed(1)}s` : '/--';

  if (state.recovering) {
    return (
      <div className="token-timer critical">
        <span className="timer-label">TTR:</span>
        <span className="timer-value">{elapsed.toFixed(1)}s{prevSuffix}</span>
      </div>
    );
  }

  // Recovered — show final duration
  return (
    <div className="token-timer good">
      <span className="timer-label">Recovered:</span>
      <span className="timer-value">{state.duration.toFixed(1)}s{prevSuffix}</span>
    </div>
  );
}

export default TtrDisplay;
