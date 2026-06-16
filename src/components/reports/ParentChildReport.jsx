import { useMemo } from 'react';
import WaffleChart from '../WaffleChart';

function ParentChildReport({ tasks, onTaskSelect }) {
  const stats = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;

    const parentIds = new Set();
    for (const t of tasks) {
      if (t.parent) parentIds.add(t.parent);
    }

    const children = tasks.filter(t => !!t.parent);
    const parents = tasks.filter(t => parentIds.has(t.id));
    const standalone = tasks.filter(t => !t.parent && !parentIds.has(t.id));
    const avgChildrenPerParent = parents.length > 0
      ? children.length / parents.length
      : 0;

    const childCountByParent = {};
    for (const t of children) {
      childCountByParent[t.parent] = (childCountByParent[t.parent] || 0) + 1;
    }

    const byChildCount = [...parents].sort((a, b) =>
      (childCountByParent[b.id] || 0) - (childCountByParent[a.id] || 0)
    );

    const parentsWithDue = parents
      .filter(t => !!t.due)
      .sort((a, b) => new Date(a.due) - new Date(b.due));

    const byUpdated = [...parents].sort((a, b) =>
      new Date(a.updated || 0) - new Date(b.updated || 0)
    );

    return {
      total: tasks.length,
      parents,
      children,
      standalone,
      avgChildrenPerParent,
      childCountByParent,
      mostChildrenParent: byChildCount[0] || null,
      fewestChildrenParent: byChildCount[byChildCount.length - 1] || null,
      firstToComplete: parentsWithDue[0] || null,
      lastToComplete: parentsWithDue[parentsWithDue.length - 1] || null,
      leastRecentlyUpdated: byUpdated[0] || null,
    };
  }, [tasks]);

  if (!stats) {
    return (
      <div className="card">
        <p>Select a list to see report.</p>
      </div>
    );
  }

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const segments = [
    { label: 'Parents', count: stats.parents.length, color: '#3182ce' },
    { label: 'Children', count: stats.children.length, color: '#dd6b20' },
    { label: 'Standalone', count: stats.standalone.length, color: '#DDD6C8' },
  ];

  const metrics = [
    { label: 'Total', value: stats.total },
    { label: 'Parents', value: stats.parents.length },
    { label: 'Children', value: stats.children.length },
    { label: 'Standalone', value: stats.standalone.length },
    { label: 'Avg children/parent', value: stats.avgChildrenPerParent.toFixed(1) },
  ];

  const spotlights = [
    stats.firstToComplete &&
      stats.firstToComplete.id !== stats.lastToComplete?.id && {
      label: 'First to complete',
      value: formatDate(stats.firstToComplete.due),
      parent: stats.firstToComplete,
    },
    stats.lastToComplete && {
      label: 'Last to complete',
      value: formatDate(stats.lastToComplete.due),
      parent: stats.lastToComplete,
    },
    stats.fewestChildrenParent &&
      stats.fewestChildrenParent.id !== stats.mostChildrenParent?.id && {
      label: 'Fewest children',
      value: stats.childCountByParent[stats.fewestChildrenParent.id] || 0,
      parent: stats.fewestChildrenParent,
    },
    stats.mostChildrenParent && {
      label: 'Most children',
      value: stats.childCountByParent[stats.mostChildrenParent.id] || 0,
      parent: stats.mostChildrenParent,
    },
    stats.leastRecentlyUpdated && {
      label: 'Longest idle',
      value: formatDate(stats.leastRecentlyUpdated.updated),
      parent: stats.leastRecentlyUpdated,
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
          marginBottom: 'var(--spacing-md, 16px)',
        }}>
          {spotlights.map(s => (
            <div
              key={s.label}
              className="card"
              onClick={() => onTaskSelect && onTaskSelect([s.parent.id])}
              style={{
                flex: '1 1 160px',
                textAlign: 'center',
                padding: 'var(--spacing-sm, 8px) var(--spacing-md, 16px)',
                cursor: onTaskSelect ? 'pointer' : 'default',
              }}
            >
              <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{s.value}</div>
              <div
                title={s.parent.title}
                style={{
                  fontSize: '0.85rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.parent.title}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <WaffleChart segments={segments} total={stats.total} onSegmentClick={(label) => {
          if (!onTaskSelect) return;
          const map = { Parents: stats.parents, Children: stats.children, Standalone: stats.standalone };
          const tasks = map[label];
          if (tasks) onTaskSelect(tasks.map(t => t.id));
        }} />
      </div>
    </div>
  );
}

export default ParentChildReport;
