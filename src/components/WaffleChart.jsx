import { useMemo } from 'react';

function WaffleChart({ segments, total, onSegmentClick }) {
  const cells = useMemo(() => {
    if (!total || !segments || segments.length === 0) return [];

    // Largest-remainder method to round proportions to exactly 100 cells
    const raw = segments.map(s => (s.count / total) * 100);
    const floored = raw.map(Math.floor);
    let remainder = 100 - floored.reduce((a, b) => a + b, 0);
    const remainders = raw.map((v, i) => ({ i, r: v - floored[i] }));
    remainders.sort((a, b) => b.r - a.r);
    for (let k = 0; k < remainder; k++) {
      floored[remainders[k].i]++;
    }

    // Build flat array of 100 cells
    const result = [];
    segments.forEach((seg, i) => {
      for (let j = 0; j < floored[i]; j++) {
        result.push({ color: seg.color, label: seg.label });
      }
    });
    return result;
  }, [segments, total]);

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(20, 1fr)',
        gap: '3px',
      }}>
        {cells.map((cell, i) => (
          <div
            key={i}
            title={cell.label}
            onClick={() => onSegmentClick && onSegmentClick(cell.label)}
            style={{
              aspectRatio: '1',
              backgroundColor: cell.color,
              borderRadius: 'var(--radius-sm, 4px)',
              cursor: onSegmentClick ? 'pointer' : undefined,
            }}
          />
        ))}
      </div>

      <div style={{
        display: 'flex',
        gap: 'var(--spacing-md, 16px)',
        marginTop: 'var(--spacing-sm, 8px)',
        flexWrap: 'wrap',
      }}>
        {segments.map(seg => (
          <div
            key={seg.label}
            onClick={() => onSegmentClick && onSegmentClick(seg.label)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: onSegmentClick ? 'pointer' : undefined }}
          >
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: seg.color,
            }} />
            <span style={{ fontSize: '0.85rem' }}>
              {seg.label}: {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WaffleChart;
