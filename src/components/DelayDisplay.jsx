import { useState, useEffect, useRef } from 'react';
import { taskAPI } from '../utils/taskApi';
import './TokenTimer.css';

function DelayDisplay() {
  const [delay, setDelay] = useState(0);
  const [flash, setFlash] = useState(null); // 'up' | 'down' | null
  const [backingOff, setBackingOff] = useState(false);
  const [operationActive, setOperationActive] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [hovered, setHovered] = useState(false);
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

    taskAPI.onBackoffChange = (active) => setBackingOff(active);
    taskAPI.onOperationChange = (active) => {
      setOperationActive(active);
      if (!active) {
        setCancelling(false);
        setHovered(false);
      }
    };

    return () => {
      taskAPI.onDelayChange = null;
      taskAPI.onBackoffChange = null;
      taskAPI.onOperationChange = null;
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
  if (delay >= 3000) {
    zone = 'critical';
  } else if (backingOff || delay >= 1500) {
    zone = 'warning';
  }

  const flashStyle = cancelling || (hovered && operationActive)
    ? {}
    : flash === 'up'
      ? { animation: 'delay-flash-up 0.4s ease-out' }
      : flash === 'down'
        ? { animation: 'delay-flash-down 0.4s ease-out' }
        : {};

  const handleClick = operationActive && !cancelling
    ? () => { taskAPI.cancelOperation(); setCancelling(true); }
    : undefined;

  return (
    <div
      className={`token-timer ${zone}${cancelling ? ' cancelling' : ''}`}
      style={flashStyle}
      onClick={handleClick}
      onMouseEnter={operationActive && !cancelling ? () => setHovered(true) : undefined}
      onMouseLeave={() => setHovered(false)}
    >
      {cancelling ? (
        <span className="timer-label">Cancelling…</span>
      ) : hovered && operationActive ? (
        <span className="timer-label">Cancel Operation</span>
      ) : (
        <>
          <span className="timer-label">Delay:</span>
          <span className="timer-value">{delay}ms</span>
        </>
      )}
    </div>
  );
}

export default DelayDisplay;
