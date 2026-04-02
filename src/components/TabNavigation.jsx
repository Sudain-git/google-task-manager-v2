import { useState, lazy, Suspense } from 'react';
import './TabNavigation.css';

// Lazy-load tab components so each becomes its own bundle chunk
const BulkInsert   = lazy(() => import('./tabs/BulkInsert'));
const BulkSetNotes = lazy(() => import('./tabs/BulkSetNotes'));
const BulkSetDates = lazy(() => import('./tabs/BulkSetDates'));
const BulkMove     = lazy(() => import('./tabs/BulkMove'));
const BulkComplete = lazy(() => import('./tabs/BulkComplete'));
const ParentChild  = lazy(() => import('./tabs/ParentChild'));
const AutoSetNotes = lazy(() => import('./tabs/AutoSetNotes'));
const ListImport   = lazy(() => import('./tabs/ListImport'));
const Reports      = lazy(() => import('./tabs/Reports'));
const Inspect      = lazy(() => import('./tabs/Inspect'));

const TABS = [
  { id: 'bulk-insert', label: 'Bulk Insert', component: BulkInsert },
  { id: 'bulk-notes', label: 'Set Notes', component: BulkSetNotes },
  { id: 'bulk-dates', label: 'Set Dates', component: BulkSetDates },
  { id: 'bulk-move', label: 'Move Tasks', component: BulkMove },
  { id: 'bulk-complete', label: 'Complete', component: BulkComplete },
  { id: 'parent-child', label: 'Parent/Child', component: ParentChild },
  { id: 'auto-notes', label: 'Auto Notes', component: AutoSetNotes },
  { id: 'youtube', label: 'List Import', component: ListImport },
  { id: 'reports', label: 'Reports', component: Reports },
  { id: 'dev', label: 'Inspect', component: Inspect },
];

function TabNavigation() {
  const [activeTab, setActiveTab] = useState('bulk-insert');
  const [pendingNav, setPendingNav] = useState(null);

  function navigateTo(tabId, taskIds, searchTerm = '', listId = '') {
    setPendingNav({ taskIds, searchTerm, listId });
    setActiveTab(tabId);
  }

  const ActiveComponent = TABS.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="tab-container">
      {/* Tab Navigation */}
      <nav className="tab-nav">
        <div className="tab-grid">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setPendingNav(null); }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Content */}
      <div className="tab-content">
        <Suspense fallback={<div className="spinner"></div>}>
          {ActiveComponent && (
            <ActiveComponent
              onNavigateTo={navigateTo}
              initialTaskIds={pendingNav?.taskIds ?? null}
              initialSearchTerm={pendingNav?.searchTerm ?? ''}
              initialListId={pendingNav?.listId ?? ''}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default TabNavigation;