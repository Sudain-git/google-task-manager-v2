import { useMemo } from 'react';
import { parseDurationSec, formatDur } from './videoDurationUtils';

function VideoSpotlightReport({ tasks, onTaskSelect }) {
  const stats = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;

    const videoTasks = tasks.filter(t =>
      t.status !== 'completed' && parseDurationSec(t.notes) > 0
    );

    if (videoTasks.length === 0) return null;

    const byDuration = [...videoTasks].sort((a, b) =>
      parseDurationSec(a.notes) - parseDurationSec(b.notes)
    );

    const withDue = videoTasks
      .filter(t => !!t.due)
      .sort((a, b) => new Date(a.due) - new Date(b.due));

    const totalSec = videoTasks.reduce((s, t) => s + (parseDurationSec(t.notes) || 0), 0);

    return {
      total: videoTasks.length,
      totalSec,
      avgSec: totalSec / videoTasks.length,
      shortest: byDuration[0] || null,
      longest: byDuration[byDuration.length - 1] || null,
      first: withDue[0] || null,
      last: withDue[withDue.length - 1] || null,
      withDueCount: withDue.length,
    };
  }, [tasks]);

  if (!stats) {
    return (
      <div className="card">
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No video tasks with durations found.</p>
      </div>
    );
  }

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const metrics = [
    { label: 'Videos', value: stats.total },
    { label: 'Total time', value: formatDur(stats.totalSec) },
    { label: 'Avg duration', value: formatDur(Math.round(stats.avgSec)) },
    { label: 'With due date', value: stats.withDueCount },
  ];

  const spotlights = [
    stats.shortest &&
      stats.shortest.id !== stats.longest?.id && {
      label: 'Shortest',
      value: formatDur(parseDurationSec(stats.shortest.notes)),
      task: stats.shortest,
    },
    stats.longest && {
      label: 'Longest',
      value: formatDur(parseDurationSec(stats.longest.notes)),
      task: stats.longest,
    },
    stats.first &&
      stats.first.id !== stats.last?.id && {
      label: 'First due',
      value: formatDate(stats.first.due),
      task: stats.first,
    },
    stats.last && {
      label: 'Last due',
      value: formatDate(stats.last.due),
      task: stats.last,
    },
  ].filter(Boolean);

  return (
    <div>
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

      {spotlights.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-sm, 8px)',
          flexWrap: 'wrap',
        }}>
          {spotlights.map(s => (
            <div
              key={s.label}
              className="card"
              onClick={() => onTaskSelect && onTaskSelect([s.task.id])}
              style={{
                flex: '1 1 160px',
                textAlign: 'center',
                padding: 'var(--spacing-sm, 8px) var(--spacing-md, 16px)',
                cursor: onTaskSelect ? 'pointer' : 'default',
              }}
            >
              <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{s.value}</div>
              <div
                title={s.task.title}
                style={{
                  fontSize: '0.85rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.task.title}
              </div>
              {s.task.notes && (
                <div
                  title={s.task.notes}
                  style={{
                    fontSize: '0.75rem',
                    opacity: 0.6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.task.notes}
                </div>
              )}
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VideoSpotlightReport;
