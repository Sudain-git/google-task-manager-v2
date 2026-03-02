import { useState, useEffect, useMemo } from 'react';
import { taskAPI } from '../../utils/taskApi';
import { findDuplicates } from '../../utils/duplicateDetector';
import FetchingIndicator from '../FetchingIndicator';
import WordCloud from '../WordCloud';
import ParentChildReport from '../reports/ParentChildReport';
import TaskTimelineChart from '../reports/TaskTimelineChart';
import UpdatedHeatmap from '../reports/UpdatedHeatmap';
import DueTimelineChart from '../reports/DueTimelineChart';
import DueHeatmap from '../reports/DueHeatmap';
import VideoDurationChart from '../reports/VideoDurationChart';

function Reports() {
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [loadingLists, setLoadingLists] = useState(true);

  // Task fetching & duplicate detection
  const [allTasks, setAllTasks] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [duplicateTaskIds, setDuplicateTaskIds] = useState([]);

  // Graphs
  const [selectedReport, setSelectedReport] = useState('parentChild');
  const [filterText, setFilterText] = useState('');

  // Selected Tasks
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [dateFilterField, setDateFilterField] = useState('due');
  const [clickCount, setClickCount] = useState(0);
  const [taskIdFilter, setTaskIdFilter] = useState(null);

  // Move operation
  const [destinationList, setDestinationList] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [moveProgress, setMoveProgress] = useState({ current: 0, total: 0 });
  const [moveResults, setMoveResults] = useState(null);

  const filteredTasks = useMemo(() => {
    if (!filterText) return allTasks;
    const lower = filterText.toLowerCase();
    return allTasks.filter(t =>
      (t.title && t.title.toLowerCase().includes(lower)) ||
      (t.notes && t.notes.toLowerCase().includes(lower))
    );
  }, [allTasks, filterText]);

  const dateFilteredTasks = useMemo(() => {
    if (taskIdFilter) return filteredTasks.filter(t => taskIdFilter.has(t.id));

    if (!dateStart && !dateEnd) return filteredTasks;
    const effectiveEnd = dateEnd || dateStart;

    return filteredTasks.filter(t => {
      const val = t[dateFilterField];
      if (!val) return false;
      const parsed = new Date(val);
      const d = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;

      if (dateStart && d < dateStart) return false;
      if (effectiveEnd && d > effectiveEnd) return false;
      return true;
    });
  }, [filteredTasks, dateStart, dateEnd, dateFilterField, taskIdFilter]);

  const { taskById, childrenOf } = useMemo(() => {
    const byId = {};
    const children = {};
    for (const t of allTasks) {
      byId[t.id] = t;
      if (t.parent) {
        if (!children[t.parent]) children[t.parent] = [];
        children[t.parent].push(t);
      }
    }
    return { taskById: byId, childrenOf: children };
  }, [allTasks]);

  function toggleTask(taskId) {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function toggleAllTasks() {
    if (selectedTaskIds.size === dateFilteredTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(dateFilteredTasks.map(t => t.id)));
    }
  }

  function handleHeatmapDateClick(date, field) {
    setSelectedTaskIds(new Set());
    setTaskIdFilter(null);
    // If switching heatmap type mid-selection, reset to click 1 with new field
    if (clickCount === 1 && field !== dateFilterField) {
      setDateStart(date);
      setDateEnd('');
      setDateFilterField(field);
      setClickCount(1);
      return;
    }
    if (clickCount === 0) {
      setDateStart(date);
      setDateEnd('');
      setDateFilterField(field);
      setClickCount(1);
    } else if (clickCount === 1) {
      let start = dateStart;
      let end = date;
      if (end < start) { [start, end] = [end, start]; }
      setDateStart(start);
      setDateEnd(end);
      setClickCount(2);
    } else {
      setDateStart('');
      setDateEnd('');
      setClickCount(0);
    }
  }

  // Load task lists on mount
  useEffect(() => {
    loadTaskLists();
  }, []);

  // Auto-fetch tasks when source list changes
  useEffect(() => {
    if (selectedList) {
      fetchAndDetect(selectedList);
    } else {
      setAllTasks([]);
      setDuplicates([]);
      setDuplicateTaskIds([]);
      setMoveResults(null);
    }
  }, [selectedList]);

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

  async function fetchAndDetect(listId) {
    try {
      setIsFetching(true);
      setMoveResults(null);
      const tasks = await taskAPI.getAllTasksFromList(listId, false, false);
      setAllTasks(tasks);
      const { duplicates: found } = findDuplicates(tasks, 'title');
      setDuplicates(found);
      const idSet = new Set();
      for (const d of found) {
        idSet.add(d.task.id);
        idSet.add(d.duplicateOf.id);
      }
      setDuplicateTaskIds([...idSet]);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      alert('Failed to fetch tasks: ' + error.message);
    } finally {
      setIsFetching(false);
    }
  }

  async function handleMoveDuplicates() {
    if (!destinationList || duplicateTaskIds.length === 0) return;

    const taskIds = duplicateTaskIds;
    setIsMoving(true);
    setMoveProgress({ current: 0, total: taskIds.length });
    setMoveResults(null);

    try {
      const results = await taskAPI.bulkMoveTasks(
        selectedList,
        destinationList,
        taskIds,
        (current, total) => setMoveProgress({ current, total }),
        true
      );

      setMoveResults({
        success: results.successful.length,
        failed: results.failed.length
      });

      // Re-fetch and re-detect after move
      await fetchAndDetect(selectedList);
    } catch (error) {
      console.error('Move failed:', error);
      setMoveResults({ success: 0, failed: taskIds.length, error: error.message });
    } finally {
      setIsMoving(false);
    }
  }

  const selectedListName = taskLists.find(l => l.id === selectedList)?.title || '';
  const destListName = taskLists.find(l => l.id === destinationList)?.title || '';
  const hasFetched = !isFetching && selectedList && allTasks.length >= 0 && !loadingLists;

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
        <h2>Reports</h2>
        <p>View reports and analytics.</p>
      </div>

      {/* Task List Selection */}
      <div className="form-section">
        <h3>Select Task List</h3>
        <div className="form-group">
          <label htmlFor="task-list">Task List</label>
          <select
            id="task-list"
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
          >
            <option value="">Select a list...</option>
            {taskLists.map(list => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isFetching && <FetchingIndicator message="Fetching tasks..." subMessage="Scanning for duplicates" />}

      {hasFetched && (
        <>
          {/* Section 1: Duplicates */}
          <details className="results-details">
            <summary>Duplicates ({duplicateTaskIds.length})</summary>
            <div className="card">
              <p>Found {duplicateTaskIds.length} duplicate task{duplicateTaskIds.length !== 1 ? 's' : ''} in "{selectedListName}".</p>

              {duplicates.length > 0 && (
                <>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                      <input
                        type="checkbox"
                        checked={duplicateTaskIds.length > 0 && duplicateTaskIds.every(id => selectedTaskIds.has(id))}
                        onChange={() => {
                          const allSelected = duplicateTaskIds.every(id => selectedTaskIds.has(id));
                          setSelectedTaskIds(prev => {
                            const next = new Set(prev);
                            for (const id of duplicateTaskIds) {
                              if (allSelected) next.delete(id); else next.add(id);
                            }
                            return next;
                          });
                        }}
                      />
                      Tasks ({duplicateTaskIds.length})
                    </label>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        borderBottom: '1px solid var(--border-color)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}>
                        <span style={{ width: '1rem' }} />
                        <span style={{ flex: 1 }}>Title</span>
                        <span style={{ flex: 'none' }}>Due</span>
                      </div>
                      {duplicateTaskIds.map(id => {
                        const task = taskById[id];
                        if (!task) return null;
                        return (
                          <div
                            key={task.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 'var(--spacing-xs)',
                              padding: 'var(--spacing-xs) var(--spacing-sm)',
                              borderBottom: '1px solid var(--border-color)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.has(task.id)}
                              onChange={() => toggleTask(task.id)}
                              style={{ cursor: 'pointer', marginTop: '2px' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ cursor: 'pointer' }} onClick={() => toggleTask(task.id)}>
                                {task.title}
                              </div>
                              {(task.parent && taskById[task.parent] || childrenOf[task.id]) && (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                  {task.parent && taskById[task.parent] && (
                                    <span
                                      onClick={() => { setTaskIdFilter(new Set([task.parent])); setSelectedTaskIds(new Set([task.parent])); }}
                                      style={{
                                        fontSize: '0.7rem',
                                        color: '#3182ce',
                                        cursor: 'pointer',
                                        background: 'rgba(49,130,206,0.1)',
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                      }}
                                      title={`Select parent: ${taskById[task.parent].title}`}
                                    >
                                      Parent: {taskById[task.parent].title}
                                    </span>
                                  )}
                                  {childrenOf[task.id] && (
                                    <span
                                      onClick={() => { const ids = childrenOf[task.id].map(c => c.id); setTaskIdFilter(new Set(ids)); setSelectedTaskIds(new Set(ids)); }}
                                      style={{
                                        fontSize: '0.7rem',
                                        color: '#dd6b20',
                                        cursor: 'pointer',
                                        background: 'rgba(221,107,32,0.1)',
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                      }}
                                      title={`Select ${childrenOf[task.id].length} children`}
                                    >
                                      {childrenOf[task.id].length} children
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {task.due && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', flex: 'none', marginTop: '2px' }}>
                                {new Date(task.due).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="dest-list">Move duplicates to</label>
                    <select
                      id="dest-list"
                      value={destinationList}
                      onChange={(e) => setDestinationList(e.target.value)}
                    >
                      <option value="">Select destination...</option>
                      {taskLists
                        .filter(l => l.id !== selectedList)
                        .map(list => (
                          <option key={list.id} value={list.id}>
                            {list.title}
                          </option>
                        ))}
                    </select>
                  </div>

                  <button
                    className="primary"
                    disabled={!destinationList || isMoving}
                    onClick={handleMoveDuplicates}
                  >
                    {isMoving
                      ? `Moving... (${moveProgress.current}/${moveProgress.total})`
                      : `Move ${duplicateTaskIds.length} Duplicate${duplicateTaskIds.length !== 1 ? 's' : ''} to ${destListName || '...'}`}
                  </button>

                  {isMoving && (
                    <div className="progress-container">
                      <div
                        className="progress-bar"
                        style={{ width: `${moveProgress.total ? (moveProgress.current / moveProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                  )}

                  {moveResults && (
                    <p style={{ marginTop: 'var(--spacing-sm)' }}>
                      {moveResults.error
                        ? `Move failed: ${moveResults.error}`
                        : `Moved ${moveResults.success} task${moveResults.success !== 1 ? 's' : ''} successfully${moveResults.failed > 0 ? `, ${moveResults.failed} failed` : ''}.`}
                    </p>
                  )}
                </>
              )}
            </div>
          </details>

          {/* Section 2: Wordcloud */}
          <details className="results-details">
            <summary>Wordcloud</summary>
            <WordCloud tasks={allTasks} />
          </details>

          {/* Section 3: Graphs */}
          <details className="results-details">
            <summary>Graphs</summary>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
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
                  <option value="videoDuration">Video Duration</option>
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

            {selectedReport === 'parentChild' && (
              <ParentChildReport tasks={filteredTasks} onTaskSelect={(ids) => {
                setDateStart('');
                setDateEnd('');
                setClickCount(0);
                setTaskIdFilter(new Set(ids));
                setSelectedTaskIds(new Set(ids));
              }} />
            )}
            {selectedReport === 'timeline' && (
              <TaskTimelineChart tasks={filteredTasks} />
            )}
            {selectedReport === 'heatmap' && (
              <UpdatedHeatmap
                tasks={filteredTasks}
                onDateClick={(d) => handleHeatmapDateClick(d, 'updated')}
                dateStart={dateFilterField === 'updated' ? dateStart : ''}
                dateEnd={dateFilterField === 'updated' ? dateEnd : ''}
              />
            )}
            {selectedReport === 'dueTimeline' && (
              <DueTimelineChart tasks={filteredTasks} />
            )}
            {selectedReport === 'dueHeatmap' && (
              <DueHeatmap
                tasks={filteredTasks}
                onDateClick={(d) => handleHeatmapDateClick(d, 'due')}
                dateStart={dateFilterField === 'due' ? dateStart : ''}
                dateEnd={dateFilterField === 'due' ? dateEnd : ''}
              />
            )}
            {selectedReport === 'videoDuration' && (
              <VideoDurationChart
                tasks={filteredTasks}
                onTaskSelect={(ids) => {
                  setDateStart('');
                  setDateEnd('');
                  setClickCount(0);
                  setTaskIdFilter(new Set(ids));
                  setSelectedTaskIds(new Set(ids));
                }}
                onDateClick={(d) => handleHeatmapDateClick(d, 'due')}
              />
            )}
          </details>

          {/* Section 4: Selected Tasks */}
          <details className="results-details">
            <summary>Selected Tasks ({selectedTaskIds.size})</summary>
            <div className="form-group">
              <label>Date Range{dateStart || dateEnd ? ` (by ${dateFilterField === 'updated' ? 'Updated' : 'Due'})` : ''}</label>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => {
                    setDateStart(e.target.value);
                    setClickCount(e.target.value ? 1 : 0);
                    setTaskIdFilter(null);
                  }}
                  style={{ flex: '1 1 0', minWidth: 'calc(10ch + 3.75rem)' }}
                />
                <span style={{ color: 'var(--text-tertiary)', flex: 'none' }}>to</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => {
                    setDateEnd(e.target.value);
                    setClickCount(e.target.value ? 2 : dateStart ? 1 : 0);
                    setTaskIdFilter(null);
                  }}
                  style={{ flex: '1 1 0', minWidth: 'calc(10ch + 3.75rem)' }}
                />
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <input
                  type="checkbox"
                  checked={dateFilteredTasks.length > 0 && selectedTaskIds.size === dateFilteredTasks.length}
                  onChange={toggleAllTasks}
                />
                Tasks ({dateFilteredTasks.length})
              </label>
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                {dateFilteredTasks.length === 0 ? (
                  <p style={{ padding: 'var(--spacing-sm)', color: 'var(--text-tertiary)', margin: 0 }}>No tasks in range.</p>
                ) : (
                  <>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-xs)',
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}>
                      <span style={{ width: '1rem' }} />
                      <span style={{ flex: 1 }}>Title</span>
                      <span style={{ flex: 'none' }}>{dateFilterField === 'updated' ? 'Updated' : 'Due'}</span>
                    </div>
                    {dateFilteredTasks.map(task => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 'var(--spacing-xs)',
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(task.id)}
                          onChange={() => toggleTask(task.id)}
                          style={{ cursor: 'pointer', marginTop: '2px' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ cursor: 'pointer' }} onClick={() => toggleTask(task.id)}>
                            {task.title}
                          </div>
                          {task.notes && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px', whiteSpace: 'pre-line' }}>
                              {task.notes}
                            </div>
                          )}
                          {(task.parent && taskById[task.parent] || childrenOf[task.id]) && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                              {task.parent && taskById[task.parent] && (
                                <span
                                  onClick={() => { setTaskIdFilter(new Set([task.parent])); setSelectedTaskIds(new Set([task.parent])); }}
                                  style={{
                                    fontSize: '0.7rem',
                                    color: '#3182ce',
                                    cursor: 'pointer',
                                    background: 'rgba(49,130,206,0.1)',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                  }}
                                  title={`Select parent: ${taskById[task.parent].title}`}
                                >
                                  Parent: {taskById[task.parent].title}
                                </span>
                              )}
                              {childrenOf[task.id] && (
                                <span
                                  onClick={() => { const ids = childrenOf[task.id].map(c => c.id); setTaskIdFilter(new Set(ids)); setSelectedTaskIds(new Set(ids)); }}
                                  style={{
                                    fontSize: '0.7rem',
                                    color: '#dd6b20',
                                    cursor: 'pointer',
                                    background: 'rgba(221,107,32,0.1)',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                  }}
                                  title={`Select ${childrenOf[task.id].length} children`}
                                >
                                  {childrenOf[task.id].length} children
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {task[dateFilterField] && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', flex: 'none', marginTop: '2px' }}>
                            {new Date(task[dateFilterField]).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </details>

        </>
      )}
    </div>
  );
}

export default Reports;
