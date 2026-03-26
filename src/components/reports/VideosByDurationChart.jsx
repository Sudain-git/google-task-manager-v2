import { useState, useMemo } from 'react';
import { localDateStr, parseDurationSec, BRACKETS } from './videoDurationUtils';

function VideosByDurationChart({ tasks, onTaskSelect }) {
  const [dueDateFilter, setDueDateFilter] = useState('has-due');
  const _today0 = new Date();
  const _from0 = new Date(_today0); _from0.setDate(_from0.getDate() - 30);
  const _to0 = new Date(_today0); _to0.setDate(_to0.getDate() + 30);
  const [startDate, setStartDate] = useState(localDateStr(_from0));
  const [endDate, setEndDate] = useState(localDateStr(_to0));
  const [rangeMode, setRangeMode] = useState('60d');

  const videoTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => {
      if (t.status === 'completed' || !(parseDurationSec(t.notes) > 0)) return false;
      if (dueDateFilter === 'has-due') return !!t.due;
      if (dueDateFilter === 'no-due') return !t.due;
      return true;
    });
  }, [tasks, dueDateFilter]);

  const chartTasks = useMemo(() => videoTasks.filter(t => !!t.due), [videoTasks]);
  const noDueTasks = useMemo(() => videoTasks.filter(t => !t.due), [videoTasks]);

  const dateRange = useMemo(() => {
    if (chartTasks.length === 0) return { min: '', max: '' };
    const dates = chartTasks.map(t => t.due.slice(0, 10));
    dates.sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [chartTasks]);

  const effectiveStart = startDate || dateRange.min;
  const effectiveEnd = endDate || dateRange.max;

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
  }

  function handleStartChange(val) {
    setStartDate(val);
    setRangeMode('custom');
  }

  function handleEndChange(val) {
    setEndDate(val);
    setRangeMode('custom');
  }

  const categoryChartData = useMemo(() => {
    let src;
    if (dueDateFilter === 'has-due') {
      src = chartTasks.filter(t => {
        const d = t.due.slice(0, 10);
        return (!effectiveStart || d >= effectiveStart) && (!effectiveEnd || d <= effectiveEnd);
      });
    } else if (dueDateFilter === 'either') {
      const filteredHasDue = chartTasks.filter(t => {
        const d = t.due.slice(0, 10);
        return (!effectiveStart || d >= effectiveStart) && (!effectiveEnd || d <= effectiveEnd);
      });
      src = [...filteredHasDue, ...noDueTasks];
    } else {
      src = noDueTasks;
    }
    return BRACKETS.map(b => {
      const matched = src.filter(t => b.test(parseDurationSec(t.notes)));
      const totalSec = matched.reduce((s, t) => s + (parseDurationSec(t.notes) || 0), 0);
      return { label: b.label, color: b.color, totalMin: totalSec / 60, count: matched.length, ids: matched.map(t => t.id) };
    });
  }, [chartTasks, noDueTasks, dueDateFilter, effectiveStart, effectiveEnd]);

  const totalVideos = categoryChartData.reduce((s, d) => s + d.count, 0);
  const totalMin = Math.round(categoryChartData.reduce((s, d) => s + d.totalMin, 0));

  const showDateControls = dueDateFilter !== 'no-due';

  const catPadding = { top: 30, right: 30, bottom: 40, left: 70 };
  const catW = 700;
  const catH = 230;
  const catChartW = catW - catPadding.left - catPadding.right;
  const catChartH = catH - catPadding.top - catPadding.bottom;
  const maxCatMin = Math.max(1, ...categoryChartData.map(d => d.totalMin));
  const catAxisMax = Math.max(1, Math.ceil(maxCatMin));
  const catNumTicks = Math.min(catAxisMax + 1, 6);
  const catTickStep = catNumTicks > 1 ? catAxisMax / (catNumTicks - 1) : 1;
  const catYTicks = Array.from({ length: catNumTicks }, (_, i) => Math.round(catTickStep * i));
  const barSlotW = catChartW / 5;
  const catBarW = barSlotW * 0.7;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card" style={{ marginBottom: 'var(--spacing-sm, 8px)' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="vbd-due-filter">Due Date</label>
            <select
              id="vbd-due-filter"
              value={dueDateFilter}
              onChange={e => setDueDateFilter(e.target.value)}
            >
              <option value="no-due">No due date</option>
              <option value="has-due">Has due date</option>
              <option value="either">Either</option>
            </select>
          </div>
          {showDateControls && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="vbd-start">From</label>
                <input
                  id="vbd-start"
                  type="date"
                  value={effectiveStart}
                  onChange={e => handleStartChange(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="vbd-end">To</label>
                <input
                  id="vbd-end"
                  type="date"
                  value={effectiveEnd}
                  onChange={e => handleEndChange(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="vbd-range">Range</label>
                <select
                  id="vbd-range"
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
            </>
          )}
          {videoTasks.length > 0 && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingBottom: '6px' }}>
              {totalVideos} video{totalVideos !== 1 ? 's' : ''} · {totalMin} min total
            </div>
          )}
        </div>
      </div>

      {videoTasks.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No video tasks with durations found.</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #4a5568)', marginBottom: '6px' }}>Video tasks by duration</div>
          <svg
            viewBox={`0 0 ${catW} ${catH}`}
            style={{ width: '100%', height: 'auto', display: 'block', marginBottom: '8px' }}
          >
            {catYTicks.map(tick => {
              const y = catPadding.top + catChartH - (tick / catAxisMax) * catChartH;
              return (
                <line
                  key={`cgrid-${tick}`}
                  x1={catPadding.left} y1={y}
                  x2={catPadding.left + catChartW} y2={y}
                  stroke="var(--border-color, #e2e8f0)" strokeWidth="0.5"
                />
              );
            })}

            {catYTicks.map(tick => {
              const y = catPadding.top + catChartH - (tick / catAxisMax) * catChartH;
              return (
                <text
                  key={`cy-${tick}`}
                  x={catPadding.left - 8} y={y + 4}
                  textAnchor="end" fontSize="11"
                  fill="var(--text-secondary, #4a5568)"
                >
                  {tick}
                </text>
              );
            })}

            <text
              x="14" y="110"
              transform="rotate(-90, 14, 110)"
              textAnchor="middle" fontSize="11"
              fill="var(--text-secondary, #4a5568)"
            >
              min
            </text>

            {categoryChartData.map((d, i) => {
              const centerX = catPadding.left + i * barSlotW + barSlotW / 2;
              const barH = (d.totalMin / catAxisMax) * catChartH;
              const barY = catPadding.top + catChartH - barH;
              const barX = centerX - catBarW / 2;
              const clickable = d.ids.length > 0 && !!onTaskSelect;
              return (
                <g key={`cbar-${d.label}`}>
                  {d.totalMin > 0 && (
                    <rect
                      x={barX} y={barY}
                      width={catBarW} height={barH}
                      fill={d.color}
                      style={{ cursor: clickable ? 'pointer' : 'default' }}
                      onClick={() => clickable && onTaskSelect(d.ids)}
                    >
                      <title>{`${d.label}: ${d.count} task(s) · ${d.totalMin.toFixed(1)} min`}</title>
                    </rect>
                  )}
                  {d.count > 0 && (
                    <text
                      x={centerX} y={barY - 4}
                      textAnchor="middle" fontSize="10"
                      fill="var(--text-secondary, #4a5568)"
                      style={{ cursor: clickable ? 'pointer' : 'default', userSelect: 'none' }}
                      onClick={() => clickable && onTaskSelect(d.ids)}
                    >
                      {d.count}
                    </text>
                  )}
                  <text
                    x={centerX}
                    y={catH - 10}
                    textAnchor="middle" fontSize="10"
                    fill="var(--text-secondary, #4a5568)"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}

            <line
              x1={catPadding.left} y1={catPadding.top}
              x2={catPadding.left} y2={catPadding.top + catChartH}
              stroke="var(--border-color, #e2e8f0)" strokeWidth="1"
            />
            <line
              x1={catPadding.left} y1={catPadding.top + catChartH}
              x2={catPadding.left + catChartW} y2={catPadding.top + catChartH}
              stroke="var(--border-color, #e2e8f0)" strokeWidth="1"
            />
          </svg>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
            {categoryChartData.map(d => {
              const active = d.ids.length > 0 && !!onTaskSelect;
              return (
                <div
                  key={d.label}
                  onClick={() => active && onTaskSelect(d.ids)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    cursor: active ? 'pointer' : 'default',
                    opacity: d.ids.length > 0 ? 1 : 0.35,
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary, #4a5568)',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: d.color, display: 'inline-block', flexShrink: 0 }} />
                  {d.label}
                  {d.count > 0 && (
                    <span style={{ color: 'var(--text-tertiary, #718096)', fontSize: '0.7rem' }}>({d.count})</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default VideosByDurationChart;
