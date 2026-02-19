import { useState } from 'react';
import './TabNavigation.css';

// Import tab components
import BulkInsert from './tabs/BulkInsert';
import BulkSetNotes from './tabs/BulkSetNotes';
import BulkSetDates from './tabs/BulkSetDates';
import BulkMove from './tabs/BulkMove';
import BulkComplete from './tabs/BulkComplete';
import ParentChild from './tabs/ParentChild';
import AutoSetNotes from './tabs/AutoSetNotes';
import ListImport from './tabs/ListImport';
import Reports from './tabs/Reports';
import Inspect from './tabs/Inspect';

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
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Content */}
      <div className="tab-content">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}

export default TabNavigation;