import { useState, useMemo } from 'react';

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function TaskTimelineChart({ tasks }) {
  const _today0 = new Date();
  const _from0 = new Date(_today0); _from0.setDate(_from0.getDate() - 7);
  const _to0 = new Date(_today0); _to0.setDate(_to0.getDate() + 7);
  const [startDate, setStartDate] = useState(localDateStr(_from0));
  const [endDate, setEndDate] = useState(localDateStr(_to0));
  const [rangeMode, setRangeMode] = useState('14d');

  const dateRange = useMemo(() => {
    if (!tasks || tasks.length === 0) return { min: '', max: '' };
    const dates = tasks
      .filter(t => t.updated)
      .map(t => t.updated.slice(0, 10));
    if (dates.length === 0) return { min: '', max: '' };
    dates.sort();
    const today = new Date().toISOString().slice(0, 10);
    return { min: dates[0], max: today };
  }, [tasks]);

  const effectiveStart = startDate || dateRange.min;
  const effectiveEnd = endDate || dateRange.max;

  const dataPoints = useMemo(() => {
    if (!effectiveStart || !effectiveEnd || !tasks || tasks.length === 0) return [];

    const counts = {};
    for (const t of tasks) {
      if (!t.updated) continue;
      const d = t.updated.slice(0, 10);
      if (d >= effectiveStart && d <= effectiveEnd) {
        counts[d] = (counts[d] || 0) + 1;
      }
    }

    const points = [];
    const cur = new Date(effectiveStart + 'T00:00:00');
    const end = new Date(effectiveEnd + 'T00:00:00');
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      points.push({ date: key, count: counts[key] || 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return points;
  }, [tasks, effectiveStart, effectiveEnd]);

  function handleRangeChange(mode) {
    setRangeMode(mode);
    if (mode === 'full') {
      setStartDate('');
      setEndDate('');
    } else if (mode === '14d') {
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      const to = new Date(today);
      to.setDate(to.getDate() + 7);
      setStartDate(localDateStr(from));
      setEndDate(localDateStr(to));
    } else if (mode === '60d') {
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      const to = new Date(today);
      to.setDate(to.getDate() + 30);
      setStartDate(localDateStr(from));
      setEndDate(localDateStr(to));
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

  if (!tasks || tasks.length === 0) {
    return (
      <div className="card">
        <p>Select a list to see report.</p>
      </div>
    );
  }

  const maxCount = Math.max(1, ...dataPoints.map(p => p.count));
  const totalInRange = dataPoints.reduce((s, p) => s + p.count, 0);

  // Chart dimensions
  const padding = { top: 20, right: 20, bottom: 50, left: 45 };
  const width = 800;
  const height = 300;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Y-axis ticks
  const yTickCount = Math.min(maxCount, 5);
  const yTicks = [];
  for (let i = 0; i <= yTickCount; i++) {
    yTicks.push(Math.round((maxCount / yTickCount) * i));
  }

  // Build polyline points
  const polyPoints = dataPoints.map((p, i) => {
    const x = padding.left + (dataPoints.length > 1 ? (i / (dataPoints.length - 1)) * chartW : chartW / 2);
    const y = padding.top + chartH - (p.count / maxCount) * chartH;
    return `${x},${y}`;
  }).join(' ');

  // X-axis label spacing: show at most ~10 labels
  const xLabelInterval = Math.max(1, Math.floor(dataPoints.length / 10));

  return (
    <div>
      <div className="card" style={{ marginBottom: 'var(--spacing-sm, 8px)' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="timeline-start">From</label>
            <input
              id="timeline-start"
              type="date"
              value={effectiveStart}
              onChange={e => handleStartChange(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="timeline-end">To</label>
            <input
              id="timeline-end"
              type="date"
              value={effectiveEnd}
              onChange={e => handleEndChange(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="task-timeline-range">Range</label>
            <select
              id="task-timeline-range"
              value={rangeMode}
              onChange={e => handleRangeChange(e.target.value)}
            >
              <option value="full">Full Range</option>
              <option value="14d">+/- 7 days</option>
              <option value="60d">+/- 30 days</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingBottom: '6px' }}>
            {totalInRange} task{totalInRange !== 1 ? 's' : ''} in range
          </div>
        </div>
      </div>

      {dataPoints.length > 0 && (
        <div className="card">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          >
            {/* Grid lines */}
            {yTicks.map(tick => {
              const y = padding.top + chartH - (tick / maxCount) * chartH;
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
              const y = padding.top + chartH - (tick / maxCount) * chartH;
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

            {/* X-axis labels */}
            {dataPoints.map((p, i) => {
              if (i % xLabelInterval !== 0 && i !== dataPoints.length - 1) return null;
              const x = padding.left + (dataPoints.length > 1 ? (i / (dataPoints.length - 1)) * chartW : chartW / 2);
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

            {/* Data line */}
            {dataPoints.length > 1 && (
              <polyline
                points={polyPoints}
                fill="none"
                stroke="var(--accent-primary, #3182ce)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            )}

            {/* Data points */}
            {dataPoints.map((p, i) => {
              const x = padding.left + (dataPoints.length > 1 ? (i / (dataPoints.length - 1)) * chartW : chartW / 2);
              const y = padding.top + chartH - (p.count / maxCount) * chartH;
              return (
                <circle
                  key={`pt-${i}`}
                  cx={x}
                  cy={y}
                  r={dataPoints.length > 60 ? 2 : 3.5}
                  fill="var(--accent-primary, #3182ce)"
                >
                  <title>{`${p.date}: ${p.count} task${p.count !== 1 ? 's' : ''}`}</title>
                </circle>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

export default TaskTimelineChart;
