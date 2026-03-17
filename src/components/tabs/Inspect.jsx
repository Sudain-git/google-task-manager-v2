import { useState, useEffect, useMemo } from 'react';
import { taskAPI } from '../../utils/taskApi';
import FetchingIndicator from '../FetchingIndicator';

function Inspect({ initialListId, initialTaskIds }) {
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [loadingLists, setLoadingLists] = useState(true);
  const [allTasks, setAllTasks] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showFields, setShowFields] = useState({
    taskName: true,
    dueDate: true,
    notes: false,
    parentStatus: false,
  });

  function toggleField(key) {
    setShowFields(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const filteredTasks = useMemo(() => {
    if (!filterText) return allTasks;
    const lower = filterText.toLowerCase();
    return allTasks.filter(t =>
      (t.title && t.title.toLowerCase().includes(lower)) ||
      (t.notes && t.notes.toLowerCase().includes(lower))
    );
  }, [allTasks, filterText]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return allTasks.find(t => t.id === selectedTaskId) || null;
  }, [allTasks, selectedTaskId]);

  function getParentStatusText(task) {
    if (!task) return '';
    const hasParent = !!task.parent;
    const parentTask = hasParent ? allTasks.find(t => t.id === task.parent) : null;
    const childCount = allTasks.filter(t => t.parent === task.id).length;

    if (hasParent && !parentTask) return 'Orphan';
    if (hasParent && parentTask)  return `Child of "${parentTask.title || '(untitled)'}"`;
    if (childCount > 0)           return `Parent (${childCount} child${childCount !== 1 ? 'ren' : ''})`;
    return 'Top-level';
  }

  useEffect(() => {
    loadTaskLists();
  }, []);

  useEffect(() => {
    if (!loadingLists && initialListId) {
      setSelectedList(initialListId);
      fetchTasks(initialListId).then(() => {
        if (initialTaskIds?.length === 1) {
          setSelectedTaskId(initialTaskIds[0]);
        }
      });
    }
  }, [loadingLists]);

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
      const tasks = await taskAPI.getAllTasksFromList(listId, true, true);
      setAllTasks(tasks);
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
    setSelectedTaskId(null);
    fetchTasks(value);
  }

  function handleCopyJson() {
    if (!selectedTask) return;
    navigator.clipboard.writeText(JSON.stringify(selectedTask, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
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
        <h2>Inspect</h2>
        <p>Task inspector.</p>
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
            <label htmlFor="filter-text">Filter</label>
            <input
              id="filter-text"
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Filter by title or notes..."
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
          {[
            { key: 'taskName',     label: 'Task Name' },
            { key: 'dueDate',      label: 'Due Date' },
            { key: 'notes',        label: 'Notes' },
            { key: 'parentStatus', label: 'Parent/Child/Orphan Status' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showFields[key]}
                onChange={() => toggleField(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {isFetching && (
        <FetchingIndicator
          message="Fetching Tasks..."
          subMessage="Loading all tasks including completed"
        />
      )}

      {!isFetching && selectedList && allTasks.length > 0 && (
        <div className="form-section">
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{
                  position: 'sticky',
                  top: 0,
                  background: 'var(--bg-tertiary)',
                  zIndex: 1,
                }}>
                  <th style={{ width: '40px', padding: '8px', textAlign: 'center' }}></th>
                  {showFields.taskName    && <th style={{ padding: '8px', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Title</th>}
                  {showFields.dueDate     && <th style={{ padding: '8px', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', width: '110px' }}>Due</th>}
                  {showFields.notes       && <th style={{ padding: '8px', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Notes</th>}
                  {showFields.parentStatus && <th style={{ padding: '8px', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => (
                  <tr
                    key={task.id}
                    style={{
                      borderTop: '1px solid var(--border-color)',
                      background: task.id === selectedTaskId ? 'var(--bg-tertiary)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <input
                        type="radio"
                        name="task-select"
                        checked={task.id === selectedTaskId}
                        onChange={() => setSelectedTaskId(task.id)}
                      />
                    </td>
                    {showFields.taskName && (
                      <td style={{
                        padding: '6px 8px',
                        fontSize: '0.85rem',
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        color: task.status === 'completed' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      }}>
                        {task.title || '(untitled)'}
                      </td>
                    )}
                    {showFields.dueDate && (
                      <td style={{ padding: '6px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {task.due ? task.due.slice(0, 10) : '—'}
                      </td>
                    )}
                    {showFields.notes && (
                      <td style={{ padding: '6px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.notes || '—'}
                      </td>
                    )}
                    {showFields.parentStatus && (
                      <td style={{ padding: '6px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {getParentStatusText(task)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {filteredTasks.length} of {allTasks.length} tasks
          </p>
        </div>
      )}

      {selectedTask && (
        <div className="form-section" style={{
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--spacing-md)',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem' }}>{selectedTask.title || '(untitled)'}</h3>
            <button
              className="btn btn-secondary"
              onClick={handleCopyJson}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              {copied ? 'Copied!' : 'Copy JSON'}
            </button>
          </div>
          <pre style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-md)',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            overflowX: 'auto',
            whiteSpace: 'pre',
            userSelect: 'all',
            margin: 0,
            maxHeight: '500px',
            overflowY: 'auto',
          }}>
            {JSON.stringify(selectedTask, null, 2)}
          </pre>

          <div style={{
            marginTop: 'var(--spacing-md)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-primary)',
            padding: 'var(--spacing-md)',
          }}>
            <h4 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Field Reference</h4>
            <dl style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.5 }}>
              {[
                ['kind', 'Resource type identifier. Always "tasks#task".'],
                ['id', 'Unique task identifier assigned by Google. Used in all API calls that target this task.'],
                ['etag', 'Version tag for optimistic concurrency. Changes on every update.'],
                ['title', 'The task\'s display name. Can be empty for blank tasks.'],
                ['updated', 'RFC 3339 timestamp of the last modification. Updated automatically by the API.'],
                ['selfLink', 'Full API URL to this task resource. Can be used for direct REST calls.'],
                ['parent', 'ID of the parent task. Omitted for top-level tasks; present only for subtasks.'],
                ['position', 'Zero-padded string that controls ordering among siblings. Lower values sort first.'],
                ['notes', 'Free-text description body. Supports plain text only, no formatting.'],
                ['status', '"needsAction" for open tasks, "completed" for done. The only two valid values.'],
                ['due', 'Due date as an RFC 3339 timestamp. Only the date portion matters; time is always midnight UTC.'],
                ['completed', 'RFC 3339 timestamp of when the task was marked complete. Only present when status is "completed".'],
                ['deleted', 'Boolean flag for soft-deleted tasks. True means the task is in the trash.'],
                ['hidden', 'Boolean flag. Tasks become hidden when completed and cleared from the main view.'],
                ['links', 'Array of related links (e.g. from Gmail or Calendar). Each entry has type, description, and link.'],
                ['webViewLink', 'URL to view/edit this task in the Google Tasks web UI.'],
              ].map(([field, desc]) => (
                <div key={field} style={{ marginBottom: '4px' }}>
                  <dt style={{ display: 'inline', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{field}</dt>
                  <dd style={{ display: 'inline', margin: '0 0 0 8px', color: 'var(--text-secondary)' }}>{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inspect;
