import { useState, useEffect, useMemo } from 'react';
import { taskAPI } from '../../utils/taskApi';
import FetchingIndicator from '../FetchingIndicator';
import ParentChildReport from '../reports/ParentChildReport';
import TaskTimelineChart from '../reports/TaskTimelineChart';
import UpdatedHeatmap from '../reports/UpdatedHeatmap';
import DueTimelineChart from '../reports/DueTimelineChart';
import DueHeatmap from '../reports/DueHeatmap';

function Dev() {
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [loadingLists, setLoadingLists] = useState(true);
  const [allTasks, setAllTasks] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedReport, setSelectedReport] = useState('parentChild');
  const [filterText, setFilterText] = useState('');

  const filteredTasks = useMemo(() => {
    if (!filterText) return allTasks;
    const lower = filterText.toLowerCase();
    return allTasks.filter(t =>
      (t.title && t.title.toLowerCase().includes(lower)) ||
      (t.notes && t.notes.toLowerCase().includes(lower))
    );
  }, [allTasks, filterText]);

  // Load task lists on mount
  useEffect(() => {
    loadTaskLists();
  }, []);

  async function loadTaskLists() {
    try {
      setLoadingLists(true);
      const lists = await taskAPI.getTaskLists();
      setTaskLists(lists);
    } catch (error) {
      console.error('Failed to load task lists:', error);
      alert('Failed to load task lists: ' + error.message);
    } finally {
      setLoadingLists(false);
    }
  }

  async function fetchTasks(listId) {
    if (!listId) {
      setAllTasks([]);
      return;
    }
    try {
      setIsFetching(true);
      const tasks = await taskAPI.getAllTasksFromList(listId, false, false);
      setAllTasks(tasks.filter(t => t.status !== 'completed'));
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      alert('Failed to fetch tasks: ' + error.message);
      setAllTasks([]);
    } finally {
      setIsFetching(false);
    }
  }

  function handleListChange(e) {
    const value = e.target.value;
    setSelectedList(value);
    fetchTasks(value);
  }

  if (loadingLists) {
    return (
      <div className="tab-content">
        <div className="spinner"></div>
        <p className="text-center">Loading task lists...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="tab-header">
        <h2>Dev</h2>
        <p>Report viewer.</p>
      </div>

      <div className="form-section">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
            <label htmlFor="task-list">Source List</label>
            <select
              id="task-list"
              value={selectedList}
              onChange={handleListChange}
            >
              <option value="">Select a list...</option>
              {taskLists.map(list => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
            <label htmlFor="report-select">Report</label>
            <select
              id="report-select"
              value={selectedReport}
              onChange={e => setSelectedReport(e.target.value)}
            >
              <option value="parentChild">Parent / Child</option>
              <option value="timeline">Task Timeline</option>
              <option value="heatmap">Updated Heatmap</option>
              <option value="dueTimeline">Due Date Timeline</option>
              <option value="dueHeatmap">Due Date Heatmap</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
            <label htmlFor="filter-text">Filter</label>
            <input
              id="filter-text"
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Filter tasks..."
            />
          </div>
        </div>
      </div>

      {isFetching && (
        <FetchingIndicator
          message="Fetching Tasks..."
          subMessage="Loading tasks for report"
        />
      )}

      {selectedReport === 'parentChild' && (
        <ParentChildReport tasks={filteredTasks} />
      )}

      {selectedReport === 'timeline' && (
        <TaskTimelineChart tasks={filteredTasks} />
      )}

      {selectedReport === 'heatmap' && (
        <UpdatedHeatmap tasks={filteredTasks} />
      )}

      {selectedReport === 'dueTimeline' && (
        <DueTimelineChart tasks={filteredTasks} />
      )}

      {selectedReport === 'dueHeatmap' && (
        <DueHeatmap tasks={filteredTasks} />
      )}
    </div>
  );
}

export default Dev;
