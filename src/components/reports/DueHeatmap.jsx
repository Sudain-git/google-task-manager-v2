import { useMemo, useState } from 'react';

const CELL_SIZE = 13;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const DAY_LABEL_WIDTH = 30;
const MONTH_LABEL_HEIGHT = 18;
const EMPTY_COLOR = 'var(--border-color, #e2e8f0)';
const YEAR_PALETTES = [
  ['#fef3e2','#fde2c8','#fbc68e','#f5a623','#e89520','#d4820a','#c07000','#a85800','#8a4800','#6d3800'], // amber
  ['#fce4ec','#f8bbd0','#f48fb1','#f06292','#ec407a','#e91e63','#d81b60','#c2185b','#ad1457','#880e4f'], // rose
  ['#fff3e0','#ffe0b2','#ffcc80','#ffb74d','#ffa726','#ff9800','#f57c00','#ef6c00','#e65100','#bf4400'], // orange
  ['#fbe9e7','#ffccbc','#ffab91','#ff8a65','#ff7043','#f4511e','#e64a19','#d84315','#bf360c','#9a2c0a'], // deep orange
  ['#fff8e1','#ffecb3','#ffe082','#ffd54f','#ffca28','#ffc107','#f9a825','#f8961e','#f57f17','#c66400'], // gold
  ['#fce4ec','#f5cbcb','#efafaf','#ef9a9a','#e57373','#ef5350','#e53935','#d32f2f','#c62828','#b71c1c'], // red
];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = [
  { day: 1, label: 'Mon' },
  { day: 3, label: 'Wed' },
  { day: 5, label: 'Fri' },
];

function localDateStr(d) {
  // When d is a string (e.g. "2026-04-03T00:00:00.000Z" from Google Tasks API), slice the
  // date portion directly instead of parsing via new Date(). Parsing a UTC timestamp and then
  // calling getDate() returns the local date, which is one day behind in timezones west of UTC.
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DueHeatmap({ tasks, onDateClick, dateStart, dateEnd, selectedParentId, controls, statsTasks }) {
  const todayStr = localDateStr(new Date());
  const [showAllYears, setShowAllYears] = useState(false);

  const parentChildDates = useMemo(() => {
    if (!selectedParentId || !tasks) return new Set();
    const s = new Set();
    tasks.forEach(t => {
      if (t.parent === selectedParentId && t.due) s.add(localDateStr(t.due));
    });
    return s;
  }, [tasks, selectedParentId]);

  const parentDueDate = useMemo(() => {
    if (!selectedParentId || !tasks) return null;
    const parent = tasks.find(t => t.id === selectedParentId);
    return parent && parent.due ? localDateStr(parent.due) : null;
  }, [tasks, selectedParentId]);

  const { countsByDate, childDates, years } = useMemo(() => {
    if (!tasks || tasks.length === 0) return { countsByDate: {}, childDates: new Set(), years: [] };

    const counts = {};
    const childSet = new Set();
    let minYear = Infinity;
    let maxYear = -Infinity;
    for (const t of tasks) {
      if (!t.due) continue;
      const d = localDateStr(t.due);
      counts[d] = (counts[d] || 0) + 1;
      if (t.parent) childSet.add(d);
      const y = parseInt(d.slice(0, 4), 10);
      if (y < minYear) minYear = y;
      if (y > maxYear) maxYear = y;
    }

    if (minYear === Infinity) {
      const currentYear = new Date().getFullYear();
      minYear = currentYear;
      maxYear = currentYear;
    }

    const currentYear = new Date().getFullYear();
    const yrs = [];
    // Current year first, then remaining years ascending
    if (currentYear >= minYear && currentYear <= maxYear) {
      yrs.push(currentYear);
    }
    for (let y = minYear; y <= maxYear; y++) {
      if (y !== currentYear) yrs.push(y);
    }

    return { countsByDate: counts, childDates: childSet, years: yrs };
  }, [tasks]);

  const statsCountsByDate = useMemo(() => {
    if (!statsTasks) return countsByDate;
    const counts = {};
    for (const t of statsTasks) {
      if (!t.due) continue;
      const d = localDateStr(t.due);
      counts[d] = (counts[d] || 0) + 1;
    }
    return counts;
  }, [statsTasks, countsByDate]);

  const STEPS = 10;

  const stats = useMemo(() => {
    const entries = Object.entries(statsCountsByDate);
    if (entries.length === 0) return null;
    const total = entries.reduce((s, [, c]) => s + c, 0);
    const dates = entries.map(([d]) => d).sort();
    const oldest = new Date(dates[0] + 'T00:00:00');
    const newest = new Date(dates[dates.length - 1] + 'T00:00:00');
    const daySpan = Math.max(1, Math.round((newest - oldest) / 86400000) + 1);
    const avgPerDay = total / daySpan;
    let busiestDay = entries[0];
    for (const e of entries) {
      if (e[1] > busiestDay[1]) busiestDay = e;
    }

    let avgLeadDays = null;
    const diffs = [];
    for (const t of (statsTasks || tasks)) {
      if (!t.due || !t.updated) continue;
      const due = new Date(t.due);
      const updated = new Date(t.updated);
      diffs.push((due - updated) / 86400000);
    }
    if (diffs.length > 0) {
      avgLeadDays = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    }

    return { total, avgPerDay, busiestDay: { date: busiestDay[0], count: busiestDay[1] }, avgLeadDays };
  }, [statsCountsByDate, statsTasks, tasks]);

  const rangeStats = useMemo(() => {
    if (!dateStart) return null;
    const end = dateEnd || dateStart;
    const entries = Object.entries(statsCountsByDate).filter(([d]) => d >= dateStart && d <= end);
    if (entries.length === 0) return { total: 0, avgPerDay: 0, busiestDay: { date: dateStart, count: 0 }, avgLeadDays: null };
    const total = entries.reduce((s, [, c]) => s + c, 0);
    const dates = entries.map(([d]) => d).sort();
    const oldest = new Date(dates[0] + 'T00:00:00');
    const newest = new Date(dates[dates.length - 1] + 'T00:00:00');
    const daySpan = Math.max(1, Math.round((newest - oldest) / 86400000) + 1);
    const avgPerDay = total / daySpan;
    let busiestDay = entries[0];
    for (const e of entries) {
      if (e[1] > busiestDay[1]) busiestDay = e;
    }

    let avgLeadDays = null;
    const diffs = [];
    for (const t of (statsTasks || tasks)) {
      if (!t.due || !t.updated) continue;
      const d = localDateStr(t.due);
      if (d < dateStart || d > end) continue;
      const due = new Date(t.due);
      const updated = new Date(t.updated);
      diffs.push((due - updated) / 86400000);
    }
    if (diffs.length > 0) {
      avgLeadDays = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    }

    return { total, avgPerDay, busiestDay: { date: busiestDay[0], count: busiestDay[1] }, avgLeadDays };
  }, [statsCountsByDate, statsTasks, tasks, dateStart, dateEnd]);

  function isInRange(dateStr) {
    if (!dateStart) return false;
    if (!dateEnd) return dateStr === dateStart;
    return dateStr >= dateStart && dateStr <= dateEnd;
  }

  function buildYearGrid(year) {
    const jan1 = new Date(year, 0, 1);
    const startDow = jan1.getDay();

    // Always show through Dec 31 for all years (due dates can be in the future)
    const lastDay = new Date(year, 11, 31);
    const lastDayStr = `${year}-12-31`;

    const cells = [];
    let col = 0;
    let maxCount = 0;
    const cur = new Date(jan1);

    while (cur <= lastDay) {
      const dateStr = localDateStr(cur);
      if (dateStr > lastDayStr) break;
      const dow = cur.getDay();
      const weekCol = Math.floor((Math.round((cur - jan1) / 86400000) + startDow) / 7);
      col = Math.max(col, weekCol);
      const count = countsByDate[dateStr] || 0;
      if (count > maxCount) maxCount = count;
      cells.push({ x: weekCol, y: dow, date: dateStr, count });
      cur.setDate(cur.getDate() + 1);
    }

    maxCount = Math.max(maxCount, 4);
    const step = maxCount / STEPS;
    for (const cell of cells) {
      cell.level = cell.count === 0 ? 0 : Math.min(STEPS, Math.ceil(cell.count / step));
    }

    const totalCols = col + 1;

    const monthLabels = [];
    for (let m = 0; m < 12; m++) {
      const firstOfMonth = new Date(year, m, 1);
      const dayOfYear = Math.round((firstOfMonth - jan1) / 86400000);
      const weekCol = Math.floor((dayOfYear + startDow) / 7);
      monthLabels.push({ month: m, x: weekCol });
    }

    return { cells, totalCols, monthLabels, maxCount };
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div>
        {controls && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--spacing-sm, 8px)',
            marginBottom: 'var(--spacing-md, 16px)',
          }}>
            {controls}
          </div>
        )}
        <div className="card">
          <p>Select a list to see report.</p>
        </div>
      </div>
    );
  }

  const activeStats = rangeStats || stats;
  const metrics = activeStats ? [
    { label: 'Total with Due Date', value: activeStats.total },
    { label: 'Busiest Due Date', value: `${formatDate(activeStats.busiestDay.date)} (${activeStats.busiestDay.count})` },
    { label: 'Avg Tasks/Day', value: activeStats.avgPerDay.toFixed(1) },
    ...(activeStats.avgLeadDays != null ? [{ label: 'Average Lead Days', value: `${activeStats.avgLeadDays.toFixed(1)}d` }] : []),
  ] : [];

  const visibleYears = showAllYears ? years : years.slice(0, 2);
  const hiddenCount = years.length - visibleYears.length;

  return (
    <div>
      {(stats || controls) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--spacing-sm, 8px)',
          marginBottom: 'var(--spacing-md, 16px)',
        }}>
          {controls}
          {metrics.map(m => (
            <div key={m.label} className="card" style={{
              textAlign: 'center',
              padding: 'var(--spacing-sm, 8px) var(--spacing-md, 16px)',
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{m.value}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {visibleYears.map((year) => {
        const { cells, totalCols, monthLabels, maxCount } = buildYearGrid(year);
        const svgWidth = DAY_LABEL_WIDTH + totalCols * CELL_STEP;
        const svgHeight = MONTH_LABEL_HEIGHT + 7 * CELL_STEP + 8;
        const palette = YEAR_PALETTES[years.indexOf(year) % YEAR_PALETTES.length];
        const yearColors = [EMPTY_COLOR, ...palette];

        return (
          <div key={year} className="card" style={{ marginBottom: 'var(--spacing-md, 16px)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--spacing-sm, 8px)' }}>{year}</div>
            <div>
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                style={{ width: '100%', maxWidth: svgWidth, height: 'auto', display: 'block' }}
              >
                {/* Month labels */}
                {monthLabels.map(({ month, x }, i) => {
                  const nextX = i < monthLabels.length - 1 ? monthLabels[i + 1].x : totalCols;
                  if (nextX - x < 2) return null;
                  return (
                    <text
                      key={`month-${month}`}
                      x={DAY_LABEL_WIDTH + x * CELL_STEP}
                      y={12}
                      fontSize="11"
                      fill="var(--text-secondary, #4a5568)"
                    >
                      {MONTH_NAMES[month]}
                    </text>
                  );
                })}

                {/* Day-of-week labels */}
                {DAY_LABELS.map(({ day, label }) => (
                  <text
                    key={`day-${day}`}
                    x={DAY_LABEL_WIDTH - 6}
                    y={MONTH_LABEL_HEIGHT + day * CELL_STEP + CELL_SIZE - 2}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--text-secondary, #4a5568)"
                  >
                    {label}
                  </text>
                ))}

                {/* Heatmap cells */}
                {cells.map(cell => {
                  const cx = DAY_LABEL_WIDTH + cell.x * CELL_STEP + CELL_SIZE / 2;
                  const cy = MONTH_LABEL_HEIGHT + cell.y * CELL_STEP + CELL_SIZE / 2;
                  const s = CELL_SIZE / 2;
                  const p = s / 3;
                  return (
                    <g key={cell.date} style={{ cursor: 'pointer' }} onClick={() => onDateClick && onDateClick(cell.date)}>
                      <rect
                        x={DAY_LABEL_WIDTH + cell.x * CELL_STEP}
                        y={MONTH_LABEL_HEIGHT + cell.y * CELL_STEP}
                        width={CELL_SIZE}
                        height={CELL_SIZE}
                        rx={2}
                        ry={2}
                        fill={yearColors[cell.level]}
                        stroke={isInRange(cell.date) ? 'var(--text-primary, #1a202c)' : undefined}
                        strokeWidth={isInRange(cell.date) ? 2 : undefined}
                      >
                        <title>{`${formatDate(cell.date)}: ${cell.count} task${cell.count !== 1 ? 's' : ''}${childDates.has(cell.date) ? ' (has subtasks)' : ''}`}</title>
                      </rect>
                      {cell.date === todayStr && (
                        <polygon
                          points={`${cx},${cy-s} ${cx+p},${cy-p} ${cx+s},${cy} ${cx+p},${cy+p} ${cx},${cy+s} ${cx-p},${cy+p} ${cx-s},${cy} ${cx-p},${cy-p}`}
                          fill="#fff"
                          stroke="#000"
                          strokeWidth={1}
                          pointerEvents="none"
                        />
                      )}
                      {childDates.has(cell.date) && cell.date !== todayStr && !parentChildDates.has(cell.date) && (
                        <circle cx={cx} cy={cy} r={2} fill="#3b82f6" pointerEvents="none" />
                      )}
                      {parentChildDates.has(cell.date) && (
                        <circle cx={cx} cy={cy} r={4} fill="#3b82f6" stroke="#000" strokeWidth={1} pointerEvents="none" />
                      )}
                      {parentDueDate === cell.date && (
                        <circle cx={cx} cy={cy} r={4} fill="#22c55e" stroke="#000" strokeWidth={1} pointerEvents="none" />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            {maxCount > 0 && (() => {
              const step = maxCount / STEPS;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '10px', color: 'var(--text-secondary, #4a5568)' }}>
                  <span>0</span>
                  {yearColors.map((c, i) => (
                    <div
                      key={i}
                      style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 2, background: c }}
                      title={i === 0 ? '0' : `${Math.round(step * (i - 1)) + 1}–${Math.round(step * i)}`}
                    />
                  ))}
                  <span>{maxCount}</span>
                </div>
              );
            })()}
          </div>
        );
      })}
      {!showAllYears && hiddenCount > 0 && (
        <button
          onClick={() => setShowAllYears(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-primary)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            padding: 'var(--spacing-xs) 0',
          }}
        >
          Show {hiddenCount} more {hiddenCount === 1 ? 'year' : 'years'}
        </button>
      )}
    </div>
  );
}

export default DueHeatmap;
