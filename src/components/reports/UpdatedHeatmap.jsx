import { useMemo } from 'react';

const CELL_SIZE = 13;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const DAY_LABEL_WIDTH = 30;
const MONTH_LABEL_HEIGHT = 18;
const EMPTY_COLOR = 'var(--border-color, #e2e8f0)';
const YEAR_PALETTES = [
  ['#c6e6f7', '#6bb8e8', '#2e86c1', '#1a5276'], // sky blue
  ['#c3e6cb', '#6dca83', '#27ae60', '#1a7a42'], // emerald
  ['#d5c8f0', '#a98ede', '#7d3cc7', '#5521a0'], // violet
  ['#b5e8f0', '#5bc4d4', '#0e8fa0', '#0a6370'], // teal
  ['#f0c6d9', '#de7faa', '#c4407a', '#8c2d58'], // magenta
  ['#c8daf0', '#7ba3d4', '#3568a8', '#234980'], // steel blue
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

function UpdatedHeatmap({ tasks, onDateClick, dateStart, dateEnd }) {
  const todayStr = localDateStr(new Date());

  const { countsByDate, years } = useMemo(() => {
    if (!tasks || tasks.length === 0) return { countsByDate: {}, years: [] };

    const counts = {};
    let minYear = Infinity;
    for (const t of tasks) {
      if (!t.updated) continue;
      const d = localDateStr(t.updated);
      counts[d] = (counts[d] || 0) + 1;
      const y = parseInt(d.slice(0, 4), 10);
      if (y < minYear) minYear = y;
    }

    const currentYear = new Date().getFullYear();
    if (minYear === Infinity) minYear = currentYear;
    const yrs = [];
    for (let y = currentYear; y >= minYear; y--) {
      yrs.push(y);
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
    // Ensure strictly increasing thresholds
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daySpan = Math.max(1, Math.round((today - oldest) / 86400000) + 1);
    const avgPerDay = total / daySpan;
    let mostActiveDay = entries[0];
    for (const e of entries) {
      if (e[1] > mostActiveDay[1]) mostActiveDay = e;
    }
    return { total, avgPerDay, mostActiveDay: { date: mostActiveDay[0], count: mostActiveDay[1] } };
  }, [countsByDate]);

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
    const today = new Date();
    const todayLocalStr = localDateStr(today);
    const currentYear = today.getFullYear();

    const jan1 = new Date(year, 0, 1);
    const startDow = jan1.getDay(); // 0=Sun

    const lastDay = year === currentYear ? today : new Date(year, 11, 31);
    const lastDayStr = year === currentYear ? todayLocalStr : `${year}-12-31`;

    const cells = [];
    let col = 0;
    const cur = new Date(jan1);

    // Fill empty cells before Jan 1 in the first week
    // (those days belong to the previous year)

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

    // Compute month label positions
    const monthLabels = [];
    for (let m = 0; m < 12; m++) {
      if (year === currentYear && m > today.getMonth()) break;
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
    { label: 'Total Updated', value: stats.total },
    { label: 'Most Active Day', value: `${formatDate(stats.mostActiveDay.date)} (${stats.mostActiveDay.count})` },
    { label: 'Avg Tasks/Day', value: stats.avgPerDay.toFixed(1) },
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
                  if (nextX - x < 2) return null; // skip if too narrow
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

export default UpdatedHeatmap;
