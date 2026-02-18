import { useMemo } from 'react';

const CELL_SIZE = 13;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const DAY_LABEL_WIDTH = 30;
const MONTH_LABEL_HEIGHT = 18;
const EMPTY_COLOR = 'var(--border-color, #e2e8f0)';
const YEAR_PALETTES = [
  ['#fde2c8', '#f5a623', '#e07c00', '#a85800'], // amber
  ['#fce4ec', '#f06292', '#d81b60', '#880e4f'], // rose
  ['#fff3e0', '#ffb74d', '#f57c00', '#e65100'], // orange
  ['#fbe9e7', '#ff8a65', '#e64a19', '#bf360c'], // deep orange
  ['#fff8e1', '#ffd54f', '#f9a825', '#f57f17'], // gold
  ['#fce4ec', '#ef9a9a', '#e53935', '#b71c1c'], // red
];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = [
  { day: 1, label: 'Mon' },
  { day: 3, label: 'Wed' },
  { day: 5, label: 'Fri' },
];

function localDateStr(d) {
  if (typeof d === 'string') d = new Date(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DueHeatmap({ tasks, onDateClick, dateStart, dateEnd }) {
  const todayStr = localDateStr(new Date());

  const { countsByDate, years } = useMemo(() => {
    if (!tasks || tasks.length === 0) return { countsByDate: {}, years: [] };

    const counts = {};
    let minYear = Infinity;
    let maxYear = -Infinity;
    for (const t of tasks) {
      if (!t.due) continue;
      const d = localDateStr(t.due);
      counts[d] = (counts[d] || 0) + 1;
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

    return { countsByDate: counts, years: yrs };
  }, [tasks]);

  const { thresholds } = useMemo(() => {
    const nonZero = Object.values(countsByDate).filter(c => c > 0).sort((a, b) => a - b);
    if (nonZero.length === 0) return { thresholds: [1, 2, 3, 4] };
    const q1 = nonZero[Math.floor(nonZero.length * 0.25)] || 1;
    const q2 = nonZero[Math.floor(nonZero.length * 0.5)] || q1;
    const q3 = nonZero[Math.floor(nonZero.length * 0.75)] || q2;
    const q4 = nonZero[nonZero.length - 1] || q3;
    const t = [q1];
    if (q2 > t[0]) t.push(q2); else t.push(t[t.length - 1] + 1);
    if (q3 > t[1]) t.push(q3); else t.push(t[t.length - 1] + 1);
    if (q4 > t[2]) t.push(q4); else t.push(t[t.length - 1] + 1);
    return { thresholds: t };
  }, [countsByDate]);

  const stats = useMemo(() => {
    const entries = Object.entries(countsByDate);
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
    for (const t of tasks) {
      if (!t.due || !t.updated) continue;
      const due = new Date(t.due);
      const updated = new Date(t.updated);
      diffs.push((due - updated) / 86400000);
    }
    if (diffs.length > 0) {
      avgLeadDays = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    }

    return { total, avgPerDay, busiestDay: { date: busiestDay[0], count: busiestDay[1] }, avgLeadDays };
  }, [countsByDate, tasks]);

  function isInRange(dateStr) {
    if (!dateStart) return false;
    if (!dateEnd) return dateStr === dateStart;
    return dateStr >= dateStart && dateStr <= dateEnd;
  }

  function getColorLevel(count) {
    if (count === 0) return 0;
    if (count <= thresholds[0]) return 1;
    if (count <= thresholds[1]) return 2;
    if (count <= thresholds[2]) return 3;
    return 4;
  }

  function buildYearGrid(year) {
    const jan1 = new Date(year, 0, 1);
    const startDow = jan1.getDay();

    // Always show through Dec 31 for all years (due dates can be in the future)
    const lastDay = new Date(year, 11, 31);
    const lastDayStr = `${year}-12-31`;

    const cells = [];
    let col = 0;
    const cur = new Date(jan1);

    while (cur <= lastDay) {
      const dateStr = localDateStr(cur);
      if (dateStr > lastDayStr) break;
      const dow = cur.getDay();
      const weekCol = Math.floor((Math.round((cur - jan1) / 86400000) + startDow) / 7);
      col = Math.max(col, weekCol);
      const count = countsByDate[dateStr] || 0;
      cells.push({
        x: weekCol,
        y: dow,
        date: dateStr,
        count,
        level: getColorLevel(count),
      });
      cur.setDate(cur.getDate() + 1);
    }

    const totalCols = col + 1;

    const monthLabels = [];
    for (let m = 0; m < 12; m++) {
      const firstOfMonth = new Date(year, m, 1);
      const dayOfYear = Math.round((firstOfMonth - jan1) / 86400000);
      const weekCol = Math.floor((dayOfYear + startDow) / 7);
      monthLabels.push({ month: m, x: weekCol });
    }

    return { cells, totalCols, monthLabels };
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="card">
        <p>Select a list to see report.</p>
      </div>
    );
  }

  const metrics = stats ? [
    { label: 'Total with Due Date', value: stats.total },
    { label: 'Busiest Due Date', value: `${formatDate(stats.busiestDay.date)} (${stats.busiestDay.count})` },
    { label: 'Avg Tasks/Day', value: stats.avgPerDay.toFixed(1) },
    ...(stats.avgLeadDays != null ? [{ label: 'Average Lead Days', value: `${stats.avgLeadDays.toFixed(1)}d` }] : []),
  ] : [];

  return (
    <div>
      {stats && (
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-sm, 8px)',
          flexWrap: 'wrap',
          marginBottom: 'var(--spacing-md, 16px)',
        }}>
          {metrics.map(m => (
            <div key={m.label} className="card" style={{
              flex: '1 1 120px',
              textAlign: 'center',
              padding: 'var(--spacing-sm, 8px) var(--spacing-md, 16px)',
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{m.value}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {years.map((year, yearIdx) => {
        const { cells, totalCols, monthLabels } = buildYearGrid(year);
        const svgWidth = DAY_LABEL_WIDTH + totalCols * CELL_STEP;
        const svgHeight = MONTH_LABEL_HEIGHT + 7 * CELL_STEP + 8;
        const palette = YEAR_PALETTES[yearIdx % YEAR_PALETTES.length];
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
                {cells.map(cell => (
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
                      <title>{`${formatDate(cell.date)}: ${cell.count} task${cell.count !== 1 ? 's' : ''}`}</title>
                    </rect>
                    {cell.date === todayStr && (
                      <circle
                        cx={DAY_LABEL_WIDTH + cell.x * CELL_STEP + CELL_SIZE - 3}
                        cy={MONTH_LABEL_HEIGHT + cell.y * CELL_STEP + 3}
                        r={2.5}
                        fill="#e53e3e"
                      />
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DueHeatmap;
