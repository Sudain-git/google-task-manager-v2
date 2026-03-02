import { useState, useMemo } from 'react';

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDurationSec(notes) {
  if (!notes) return null;
  const noteText = notes.toLowerCase();
  const hourMatch = noteText.match(/(\d+)\s*hour/);
  const minMatch = noteText.match(/(\d+)\s*min/);
  const secMatch = noteText.match(/(\d+)\s*sec/);
  let totalSeconds = 0;
  if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
  if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1]);
  return totalSeconds > 0 ? totalSeconds : null;
}

function formatDur(sec) {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  if (sec >= 60) return `${Math.round(sec / 60)} min`;
  return `${sec} sec`;
}

function durationColor(sec) {
  if (sec < 60)   return '#718096'; // <1 min — gray
  if (sec < 600)  return '#38a169'; // 1–10 min — green
  if (sec < 1740) return '#3182ce'; // 11–29 min — blue
  if (sec < 3600) return '#d69e2e'; // 30–59 min — amber
  return '#805ad5';                  // 60+ min — purple
}

const BRACKETS = [
  { label: '< 1 min',   color: '#718096', test: s => s < 60 },
  { label: '1–10 min',  color: '#38a169', test: s => s >= 60 && s < 600 },
  { label: '11–29 min', color: '#3182ce', test: s => s >= 600 && s < 1740 },
  { label: '30–59 min', color: '#d69e2e', test: s => s >= 1740 && s < 3600 },
  { label: '60+ min',   color: '#805ad5', test: s => s >= 3600 },
];

function VideoDurationChart({ tasks, onTaskSelect, onDateClick }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rangeMode, setRangeMode] = useState('full');
  const [target, setTarget] = useState('none');

  const videoTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => t.due && t.status !== 'completed' && parseDurationSec(t.notes) > 0);
  }, [tasks]);

  const dateRange = useMemo(() => {
    if (videoTasks.length === 0) return { min: '', max: '' };
    const dates = videoTasks.map(t => t.due.slice(0, 10));
    dates.sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [videoTasks]);

  const effectiveStart = startDate || dateRange.min;
  const effectiveEnd = endDate || dateRange.max;

  const dataPoints = useMemo(() => {
    if (!effectiveStart || !effectiveEnd) return [];

    const byDate = {};
    for (const t of videoTasks) {
      const d = t.due.slice(0, 10);
      if (d < effectiveStart || d > effectiveEnd) continue;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({ id: t.id, title: t.title, durationSec: parseDurationSec(t.notes) });
    }

    const points = [];
    const cur = new Date(effectiveStart + 'T00:00:00');
    const end = new Date(effectiveEnd + 'T00:00:00');
    while (cur <= end) {
      const key = localDateStr(cur);
      points.push({ date: key, videos: byDate[key] || [] });
      cur.setDate(cur.getDate() + 1);
    }
    return points;
  }, [videoTasks, effectiveStart, effectiveEnd]);

  function handleRangeChange(mode) {
    setRangeMode(mode);
    if (mode === 'full') {
      setStartDate('');
      setEndDate('');
    } else if (mode === '14d') {
      const today = new Date();
      const from = new Date(today); from.setDate(from.getDate() - 7);
      const to = new Date(today); to.setDate(to.getDate() + 7);
      setStartDate(localDateStr(from));
      setEndDate(localDateStr(to));
    } else if (mode === '60d') {
      const today = new Date();
      const from = new Date(today); from.setDate(from.getDate() - 30);
      const to = new Date(today); to.setDate(to.getDate() + 30);
      setStartDate(localDateStr(from));
      setEndDate(localDateStr(to));
    } else if (mode === 'past') {
      setStartDate('');
      setEndDate(localDateStr(new Date()));
    } else if (mode === 'eoy') {
      const today = new Date();
      const eoy = new Date(today.getFullYear(), 11, 31);
      setStartDate(localDateStr(today));
      setEndDate(localDateStr(eoy));
    } else if (mode === '6mo') {
      const today = new Date();
      const sixMo = new Date(today);
      sixMo.setMonth(sixMo.getMonth() + 6);
      setStartDate(localDateStr(today));
      setEndDate(localDateStr(sixMo));
    }
    // 'custom' → no-op
  }

  function handleStartChange(val) {
    setStartDate(val);
    setRangeMode('custom');
  }

  function handleEndChange(val) {
    setEndDate(val);
    setRangeMode('custom');
  }

  if (!videoTasks.length) {
    return (
      <div className="card">
        <p>No video tasks with durations found.</p>
      </div>
    );
  }

  const totalSec = dataPoints.reduce((s, p) => s + p.videos.reduce((ss, v) => ss + v.durationSec, 0), 0);
  const totalVideos = dataPoints.reduce((s, p) => s + p.videos.length, 0);
  const totalMin = Math.round(totalSec / 60);

  // Chart dimensions
  const padding = { top: 20, right: 50, bottom: 50, left: 55 };
  const width = 900;
  const height = 300;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const numDays = dataPoints.length;
  const slotWidth = numDays > 0 ? chartW / numDays : 0;
  const barWidth = Math.max(2, slotWidth * 0.8);

  const maxMin = Math.max(1, ...dataPoints.map(p => p.videos.reduce((s, v) => s + v.durationSec, 0) / 60));

  const targetMin = useMemo(() => {
    if (target === 'none') return null;
    if (target === '60min') return 60;
    const dayTotals = dataPoints
      .map(p => p.videos.reduce((s, v) => s + v.durationSec, 0) / 60)
      .filter(m => m > 0)
      .sort((a, b) => a - b);
    if (dayTotals.length === 0) return null;
    if (target === 'average') return dayTotals.reduce((s, m) => s + m, 0) / dayTotals.length;
    if (target === 'lowerQuartile') return dayTotals[Math.floor(dayTotals.length * 0.25)] ?? dayTotals[0];
    return null;
  }, [target, dataPoints]);

  const axisMax = Math.max(1, Math.ceil(maxMin));
  const numTicks = Math.min(axisMax + 1, 6);
  const tickStep = numTicks > 1 ? axisMax / (numTicks - 1) : 1;
  const yTicks = Array.from({ length: numTicks }, (_, i) => Math.round(tickStep * i));

  const xLabelInterval = Math.max(1, Math.floor(numDays / 10));

  return (
    <div>
      <div className="card" style={{ marginBottom: 'var(--spacing-sm, 8px)' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="vd-start">From</label>
            <input
              id="vd-start"
              type="date"
              value={effectiveStart}
              onChange={e => handleStartChange(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="vd-end">To</label>
            <input
              id="vd-end"
              type="date"
              value={effectiveEnd}
              onChange={e => handleEndChange(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="vd-range">Range</label>
            <select
              id="vd-range"
              value={rangeMode}
              onChange={e => handleRangeChange(e.target.value)}
            >
              <option value="full">Full Range</option>
              <option value="past">Past</option>
              <option value="14d">+/- 7 days</option>
              <option value="60d">+/- 30 days</option>
              <option value="6mo">Today → 6 Months</option>
              <option value="eoy">Today → End of Year</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="vd-target">Target</label>
            <select
              id="vd-target"
              value={target}
              onChange={e => setTarget(e.target.value)}
            >
              <option value="none">None</option>
              <option value="lowerQuartile">Lower Quartile</option>
              <option value="average">Average</option>
              <option value="60min">60 min</option>
            </select>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingBottom: '6px' }}>
            {totalVideos} video{totalVideos !== 1 ? 's' : ''} · {totalMin} min total
          </div>
        </div>
      </div>

      <div className="card">
        {totalVideos === 0 && dataPoints.length > 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No videos in this date range.</p>
        ) : (
        <><svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', marginBottom: '8px' }}
        >
          {/* Grid lines */}
          {yTicks.map(tick => {
            const y = padding.top + chartH - (tick / axisMax) * chartH;
            return (
              <line
                key={`grid-${tick}`}
                x1={padding.left}
                y1={y}
                x2={padding.left + chartW}
                y2={y}
                stroke="var(--border-color, #e2e8f0)"
                strokeWidth="0.5"
              />
            );
          })}

          {/* Y-axis labels */}
          {yTicks.map(tick => {
            const y = padding.top + chartH - (tick / axisMax) * chartH;
            return (
              <text
                key={`y-${tick}`}
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--text-secondary, #4a5568)"
              >
                {tick}
              </text>
            );
          })}

          {/* Stacked bars + count label */}
          {dataPoints.map((p, i) => {
            const centerX = padding.left + (i + 0.5) * slotWidth;
            const x = centerX - barWidth / 2;

            // Pre-compute stack positions bottom-up
            const stack = [];
            let cY = padding.top + chartH;
            for (const v of p.videos) {
              const barH = Math.max(8, (v.durationSec / 60 / axisMax) * chartH);
              cY -= barH;
              stack.push({ v, barH, y: cY });
            }

            const topY = stack.length > 0 ? stack[stack.length - 1].y : padding.top + chartH;

            return (
              <g key={`bar-${p.date}`}>
                {stack.map((seg, vi) => (
                  <rect
                    key={`seg-${vi}`}
                    x={x}
                    y={seg.y}
                    width={barWidth}
                    height={seg.barH}
                    fill={durationColor(seg.v.durationSec)}
                    stroke={numDays <= 90 ? 'white' : 'none'}
                    strokeWidth="1.5"
                    style={{ cursor: onTaskSelect ? 'pointer' : 'default' }}
                    onClick={e => { e.stopPropagation(); onTaskSelect && onTaskSelect([seg.v.id]); }}
                  >
                    <title>{`${seg.v.title} — ${formatDur(seg.v.durationSec)}`}</title>
                  </rect>
                ))}
                {p.videos.length > 0 && numDays <= 61 && (
                  <text
                    x={centerX}
                    y={topY - 3}
                    textAnchor="middle"
                    fontSize="9"
                    fill="var(--text-secondary, #4a5568)"
                    style={{ cursor: onTaskSelect ? 'pointer' : 'default', userSelect: 'none' }}
                    onClick={() => onTaskSelect && onTaskSelect(p.videos.map(v => v.id))}
                  >
                    {p.videos.length}
                  </text>
                )}
              </g>
            );
          })}

          {/* X-axis labels */}
          {dataPoints.map((p, i) => {
            if (i % xLabelInterval !== 0 && i !== dataPoints.length - 1) return null;
            const x = padding.left + (i + 0.5) * slotWidth;
            return (
              <text
                key={`x-${i}`}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-secondary, #4a5568)"
                transform={`rotate(-30, ${x}, ${height - 8})`}
              >
                {p.date.slice(5)}
              </text>
            );
          })}

          {/* Target line */}
          {targetMin != null && targetMin <= axisMax && (() => {
            const y = padding.top + chartH - (targetMin / axisMax) * chartH;
            const label = Number.isInteger(targetMin) ? `${targetMin}` : targetMin.toFixed(1);
            return (
              <>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartW}
                  y2={y}
                  stroke="#e53e3e"
                  strokeWidth="1.5"
                  strokeDasharray="6,4"
                />
                <text
                  x={padding.left + chartW + 4}
                  y={y - 3}
                  textAnchor="start"
                  fontSize="10"
                  fill="#e53e3e"
                >
                  {label}
                </text>
              </>
            );
          })()}

          {/* Axis lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartH}
            stroke="var(--border-color, #e2e8f0)"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top + chartH}
            x2={padding.left + chartW}
            y2={padding.top + chartH}
            stroke="var(--border-color, #e2e8f0)"
            strokeWidth="1"
          />
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
          {BRACKETS.map(b => {
            const ids = dataPoints.flatMap(p => p.videos.filter(v => b.test(v.durationSec)).map(v => v.id));
            const active = ids.length > 0 && !!onTaskSelect;
            return (
              <div
                key={b.label}
                onClick={() => active && onTaskSelect(ids)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: active ? 'pointer' : 'default',
                  opacity: ids.length > 0 ? 1 : 0.35,
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary, #4a5568)',
                  userSelect: 'none',
                }}
              >
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: b.color, display: 'inline-block', flexShrink: 0 }} />
                {b.label}
                {ids.length > 0 && (
                  <span style={{ color: 'var(--text-tertiary, #718096)', fontSize: '0.7rem' }}>({ids.length})</span>
                )}
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

export default VideoDurationChart;
