import { useMemo } from 'react';
import WaffleChart from '../WaffleChart';

function ParentChildReport({ tasks }) {
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

    return {
      total: tasks.length,
      parents,
      children,
      standalone,
      avgChildrenPerParent,
    };
  }, [tasks]);

  if (!stats) {
    return (
      <div className="card">
        <p>Select a list to see report.</p>
      </div>
    );
  }

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

      <div className="card">
        <WaffleChart segments={segments} total={stats.total} />
      </div>
    </div>
  );
}

export default ParentChildReport;
