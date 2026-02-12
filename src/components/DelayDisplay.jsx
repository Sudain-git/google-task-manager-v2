import { useState, useEffect, useRef } from 'react';
import { taskAPI } from '../utils/taskApi';
import './TokenTimer.css';

function DelayDisplay() {
  const [delay, setDelay] = useState(0);
  const [flash, setFlash] = useState(null); // 'up' | 'down' | null
  const [thresholds, setThresholds] = useState(null);
  const prevDelay = useRef(0);

  useEffect(() => {
    taskAPI.onDelayChange = (newDelay) => {
      const prev = prevDelay.current;
      prevDelay.current = newDelay;
      setDelay(newDelay);

      if (prev !== 0 && newDelay !== 0 && newDelay !== prev) {
        setFlash(newDelay > prev ? 'up' : 'down');
      }
    };

    taskAPI.onThresholdsChange = (data) => setThresholds(data);

    return () => {
      taskAPI.onDelayChange = null;
      taskAPI.onThresholdsChange = null;
    };
  }, []);

  // Clear flash after animation
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(id);
  }, [flash]);

  if (delay === 0) return null;

  let zone = 'good';
  if (thresholds) {
    if (delay >= thresholds.average) {
      zone = 'critical';
    } else if (delay >= thresholds.sustainable) {
      zone = 'warning';
    }
  }

  const flashStyle = flash === 'up'
    ? { animation: 'delay-flash-up 0.4s ease-out' }
    : flash === 'down'
      ? { animation: 'delay-flash-down 0.4s ease-out' }
      : {};

  return (
    <>
      {delay > 0 && (
        <div className={`token-timer ${zone}`} style={flashStyle}>
          <span className="timer-label">Delay:</span>
          <span className="timer-value">{delay}ms</span>
        </div>
      )}
    </>
  );
}

export default DelayDisplay;
