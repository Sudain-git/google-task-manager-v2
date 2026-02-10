import { useState, useEffect, useRef } from 'react';
import { taskAPI } from '../utils/taskApi';
import './TokenTimer.css';

function DelayDisplay() {
  const [delay, setDelay] = useState(0);
  const [flash, setFlash] = useState(null); // 'up' | 'down' | null
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
    return () => { taskAPI.onDelayChange = null; };
  }, []);

  // Clear flash after animation
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(id);
  }, [flash]);

  if (delay === 0) return null;

  const flashStyle = flash === 'up'
    ? { animation: 'delay-flash-up 0.4s ease-out' }
    : flash === 'down'
      ? { animation: 'delay-flash-down 0.4s ease-out' }
      : {};

  return (
    <div className="token-timer good" style={flashStyle}>
      <span className="timer-label">Delay:</span>
      <span className="timer-value">{delay}ms</span>
    </div>
  );
}

export default DelayDisplay;
