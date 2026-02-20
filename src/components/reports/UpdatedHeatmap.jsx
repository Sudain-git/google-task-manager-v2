import { useMemo } from 'react';

const CELL_SIZE = 13;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const DAY_LABEL_WIDTH = 30;
const MONTH_LABEL_HEIGHT = 18;
const EMPTY_COLOR = 'var(--border-color, #e2e8f0)';
const STEPS = 10;
const YEAR_PALETTES = [
  ['#e0f0ff','#c6e6f7','#a0d4f1','#6bb8e8','#3ea0de','#2e86c1','#256fa3','#1d5a87','#1a5276','#133d5a'], // sky blue
  ['#e0f5e4','#c3e6cb','#97d4a5','#6dca83','#45b864','#27ae60','#209c52','#1a7a42','#156835','#105428'], // emerald
  ['#ece0f8','#d5c8f0','#c0a8e8','#a98ede','#9270d1','#7d3cc7','#6b2fb3','#5521a0','#481a8c','#3a1275'], // violet
  ['#dff5f8','#b5e8f0','#8edae4','#5bc4d4','#34b0c4','#0e8fa0','#0b7d8c','#0a6370','#084f5a','#063d46'], // teal
  ['#fae0ec','#f0c6d9','#e4a4c4','#de7faa','#d05990','#c4407a','#ae3268','#8c2d58','#742448','#5c1a38'], // magenta
  ['#e0e8f5','#c8daf0','#a8c4e4','#7ba3d4','#5688c2','#3568a8','#2c5892','#234980','#1b3a68','#142d52'], // steel blue
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

    // Compute month label positions
    const monthLabels = [];
    for (let m = 0; m < 12; m++) {
      if (year === currentYear && m > today.getMonth()) break;
      const firstOfMonth = new Date(year, m, 1);
      const dayOfYear = Math.round((firstOfMonth - jan1) / 86400000);
      const weekCol = Math.floor((dayOfYear + startDow) / 7);
      monthLabels.push({ month: m, x: weekCol });
    }

    return { cells, totalCols, monthLabels, maxCount };
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
        const { cells, totalCols, monthLabels, maxCount } = buildYearGrid(year);
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
                    {cell.date === todayStr && (() => {
                      const cx = DAY_LABEL_WIDTH + cell.x * CELL_STEP + CELL_SIZE / 2;
                      const cy = MONTH_LABEL_HEIGHT + cell.y * CELL_STEP + CELL_SIZE / 2;
                      const s = CELL_SIZE / 2;
                      const p = s / 3;
                      return (
                        <polygon
                          points={`${cx},${cy-s} ${cx+p},${cy-p} ${cx+s},${cy} ${cx+p},${cy+p} ${cx},${cy+s} ${cx-p},${cy+p} ${cx-s},${cy} ${cx-p},${cy-p}`}
                          fill="#fff"
                          stroke="#000"
                          strokeWidth={1}
                        />
                      );
                    })()}
                  </g>
                ))}
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
    </div>
  );
}

export default UpdatedHeatmap;
