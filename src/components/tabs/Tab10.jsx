import { useState, useEffect, useCallback } from 'react';
import { taskAPI } from '../../utils/taskApi';
import FetchingIndicator from '../FetchingIndicator';

function Tab10() {
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [loadingLists, setLoadingLists] = useState(true);

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [searchIn, setSearchIn] = useState('title');
  const [hasDueDate, setHasDueDate] = useState('either');
  const [hasParent, setHasParent] = useState('either');
  const [hasNotes, setHasNotes] = useState('either');
  const [dateRangeType, setDateRangeType] = useState('due');
  const [dateRangePreset, setDateRangePreset] = useState('any');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Results states
  const [allTasks, setAllTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  // Sort states
  const [sortBy, setSortBy] = useState('alphabetical');
  const [sortDirection, setSortDirection] = useState('asc');
  const [sortedTasks, setSortedTasks] = useState([]);

  // Pagination states
  const [filteredPageSize, setFilteredPageSize] = useState(10);
  const [filteredPage, setFilteredPage] = useState(1);

  // Load task lists on mount
  useEffect(() => {
    loadTaskLists();
  }, []);

  // Compute date range from preset (recalculates on each render so "Today" stays current)
  function getDateRangeFromPreset(preset) {
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    switch (preset) {
      case 'today': {
        const s = formatDate(today);
        return { start: s, end: s };
      }
      case 'yesterday': {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        const s = formatDate(d);
        return { start: s, end: s };
      }
      case 'last7': {
        const d = new Date(today);
        d.setDate(d.getDate() - 6);
        return { start: formatDate(d), end: formatDate(today) };
      }
      case 'last30': {
        const d = new Date(today);
        d.setDate(d.getDate() - 29);
        return { start: formatDate(d), end: formatDate(today) };
      }
      case 'thisMonth': {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: formatDate(first), end: formatDate(today) };
      }
      case 'lastMonth': {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        return { start: formatDate(first), end: formatDate(last) };
      }
      case 'thisYear': {
        const first = new Date(today.getFullYear(), 0, 1);
        return { start: formatDate(first), end: formatDate(today) };
      }
      case 'custom':
        return { start: dateStart, end: dateEnd };
      default: // 'any'
        return { start: '', end: '' };
    }
  }

  // Auto-apply filters whenever filter criteria or allTasks change
  useEffect(() => {
    if (allTasks.length > 0) {
      handleApplyFilters();
    }
  }, [searchText, searchIn, hasDueDate, hasParent, hasNotes, dateRangeType, dateRangePreset, dateStart, dateEnd, allTasks]);

  // Auto-apply sort whenever filtered tasks or sort criteria change
  useEffect(() => {
    handleApplySort();
  }, [filteredTasks, sortBy, sortDirection]);

  // Reset filtered page when sorted tasks change
  useEffect(() => {
    setFilteredPage(1);
  }, [sortedTasks]);

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

  async function handleFetchTasks(listId) {
    if (!listId) {
      alert('Please select a task list');
      return;
    }

    try {
      setIsFetching(true);
      setAllTasks([]);
      setFilteredTasks([]);
      setSortedTasks([]);

      console.log('[Dev] Fetching all tasks from list...');
      const tasks = await taskAPI.getAllTasksFromList(listId, false, false);

      // Filter out completed tasks automatically
      const activeTasks = tasks.filter(task => task.status !== 'completed');

      setAllTasks(activeTasks);
      console.log(`[Dev] Fetched ${activeTasks.length} active tasks`);

    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      alert('Failed to fetch tasks: ' + error.message);
    } finally {
      setIsFetching(false);
    }
  }

  function evaluateSearchExpression(expression, target) {
    let normalized = expression.replace(/,/g, '&&');
    const orParts = normalized.split('||').map(p => p.trim()).filter(p => p);
    if (orParts.length === 0) return true;
    return orParts.some(orPart => {
      const andTerms = orPart.split('&&').map(t => t.trim()).filter(t => t);
      if (andTerms.length === 0) return true;
      return andTerms.every(term => target.includes(term));
    });
  }

  const handleApplyFilters = useCallback(() => {
    let filtered = [...allTasks];

    if (searchText.trim()) {
      filtered = filtered.filter(task => {
        const titleText = task.title.toLowerCase();
        const notesText = (task.notes || '').toLowerCase();
        let searchTarget = '';
        if (searchIn === 'title') searchTarget = titleText;
        else if (searchIn === 'notes') searchTarget = notesText;
        else searchTarget = titleText + ' ' + notesText;
        return evaluateSearchExpression(searchText.toLowerCase(), searchTarget);
      });
    }

    if (hasDueDate !== 'either') {
      filtered = filtered.filter(task => {
        const hasDue = !!task.due;
        return hasDueDate === 'yes' ? hasDue : !hasDue;
      });
    }

    if (hasParent !== 'either') {
      filtered = filtered.filter(task => {
        const hasParentTask = !!task.parent;
        return hasParent === 'yes' ? hasParentTask : !hasParentTask;
      });
    }

    if (hasNotes !== 'either') {
      filtered = filtered.filter(task => {
        const hasTaskNotes = !!(task.notes && task.notes.trim());
        return hasNotes === 'yes' ? hasTaskNotes : !hasTaskNotes;
      });
    }

    const range = getDateRangeFromPreset(dateRangePreset);

    if (range.start) {
      const start = new Date(range.start);
      filtered = filtered.filter(task => {
        const field = dateRangeType === 'due' ? task.due : task.updated;
        if (!field) return false;
        return new Date(field) >= start;
      });
    }

    if (range.end) {
      const end = new Date(range.end);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(task => {
        const field = dateRangeType === 'due' ? task.due : task.updated;
        if (!field) return false;
        return new Date(field) <= end;
      });
    }

    setFilteredTasks(filtered);
  }, [allTasks, searchText, searchIn, hasDueDate, hasParent, hasNotes, dateRangeType, dateRangePreset, dateStart, dateEnd]);

  function parseDuration(notes) {
    if (!notes) return Infinity;
    const noteText = notes.toLowerCase();
    const hourMatch = noteText.match(/(\d+)\s*hour/);
    const minMatch = noteText.match(/(\d+)\s*min/);
    const secMatch = noteText.match(/(\d+)\s*sec/);
    let totalSeconds = 0;
    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    if (secMatch) totalSeconds += parseInt(secMatch[1]);
    return totalSeconds > 0 ? totalSeconds : Infinity;
  }

  const handleApplySort = useCallback(() => {
    if (filteredTasks.length === 0) {
      setSortedTasks([]);
      return;
    }

    let sorted = [...filteredTasks];

    switch (sortBy) {
      case 'alphabetical':
        sorted.sort((a, b) => {
          const titleA = a.title.toLowerCase();
          const titleB = b.title.toLowerCase();
          return sortDirection === 'asc'
            ? titleA.localeCompare(titleB)
            : titleB.localeCompare(titleA);
        });
        break;
      case 'created':
        sorted.sort((a, b) => {
          const dateA = a.updated ? new Date(a.updated).getTime() : 0;
          const dateB = b.updated ? new Date(b.updated).getTime() : 0;
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        });
        break;
      case 'duration':
        sorted.sort((a, b) => {
          const durA = parseDuration(a.notes);
          const durB = parseDuration(b.notes);
          return sortDirection === 'asc' ? durA - durB : durB - durA;
        });
        break;
      case 'dueDate':
        sorted.sort((a, b) => {
          const dueA = a.due ? new Date(a.due).getTime() : Infinity;
          const dueB = b.due ? new Date(b.due).getTime() : Infinity;
          return sortDirection === 'asc' ? dueA - dueB : dueB - dueA;
        });
        break;
      default:
        break;
    }

    setSortedTasks(sorted);
  }, [filteredTasks, sortBy, sortDirection]);

  function formatDurationPreview(seconds) {
    if (seconds === Infinity || seconds === 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return minutes > 0 ? `${hours} hour ${minutes} min` : `${hours} hour`;
    } else if (minutes > 0) {
      return `${minutes} min`;
    } else {
      return `${secs} sec`;
    }
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
        <p>Development workspace.</p>
      </div>

      {/* Task List Selection */}
      <div className="form-section">
        <h3>Select Task List</h3>
        <div className="form-group">
          <label htmlFor="task-list">Task List</label>
          <select
            id="task-list"
            value={selectedList}
            onChange={(e) => {
              setSelectedList(e.target.value);
              if (e.target.value) {
                handleFetchTasks(e.target.value);
              }
            }}
            disabled={isFetching}
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

      {/* Fetching Indicator */}
      {isFetching && (
        <FetchingIndicator
          message="Fetching Tasks from List..."
          subMessage="Loading all active tasks (excluding completed)"
        />
      )}

      {/* Filter & Sort Section */}
      {allTasks.length > 0 && (
        <div className="form-section">
          <h3>Filter & Sort Tasks ({allTasks.length} active tasks)</h3>

          <div className="bulk-dates-filter-grid">

            {/* Search Text */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="search-text">Search (use && for AND, || for OR)</label>
              <input
                id="search-text"
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="e.g., video && tutorial, or video || guide"
              />
            </div>

            {/* Search In */}
            <div className="form-group">
              <label htmlFor="search-in">Search In</label>
              <select
                id="search-in"
                value={searchIn}
                onChange={(e) => setSearchIn(e.target.value)}
              >
                <option value="both">Both</option>
                <option value="title">Title</option>
                <option value="notes">Notes</option>
              </select>
            </div>

            {/* Has Due Date */}
            <div className="form-group">
              <label htmlFor="has-due-date">Has Due Date</label>
              <select
                id="has-due-date"
                value={hasDueDate}
                onChange={(e) => setHasDueDate(e.target.value)}
              >
                <option value="either">Either</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* Has Parent */}
            <div className="form-group">
              <label htmlFor="has-parent">Has Parent</label>
              <select
                id="has-parent"
                value={hasParent}
                onChange={(e) => setHasParent(e.target.value)}
              >
                <option value="either">Either</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* Has Notes */}
            <div className="form-group">
              <label htmlFor="has-notes">Has Notes</label>
              <select
                id="has-notes"
                value={hasNotes}
                onChange={(e) => setHasNotes(e.target.value)}
              >
                <option value="either">Either</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* Sort */}
            <div className="form-group">
              <label htmlFor="sort">Sort</label>
              <select
                id="sort"
                value={`${sortBy}-${sortDirection}`}
                onChange={(e) => {
                  const [newSortBy, newDirection] = e.target.value.split('-');
                  setSortBy(newSortBy);
                  setSortDirection(newDirection);
                }}
              >
                <option value="alphabetical-asc">Alphabetical A → Z</option>
                <option value="alphabetical-desc">Alphabetical Z → A</option>
                <option value="created-asc">Created Oldest First</option>
                <option value="created-desc">Created Newest First</option>
                <option value="duration-asc">Duration Shortest First</option>
                <option value="duration-desc">Duration Longest First</option>
                <option value="dueDate-asc">Due Date Earliest First</option>
                <option value="dueDate-desc">Due Date Latest First</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="form-group dev-date-range">
              <label>Date Range</label>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                <select
                  value={dateRangeType}
                  onChange={(e) => { setDateRangeType(e.target.value); }}
                  style={{ width: `calc(${dateRangeType === 'due' ? 3 : 7}ch + 3.75rem)`, flex: 'none' }}
                >
                  <option value="created">Created</option>
                  <option value="due">Due</option>
                </select>
                <select
                  value={dateRangePreset}
                  onChange={(e) => {
                    setDateRangePreset(e.target.value);
                    if (e.target.value !== 'custom') {
                      setDateStart('');
                      setDateEnd('');
                    }
                  }}
                  style={{ width: `calc(${{ any: 8, today: 5, yesterday: 9, last7: 11, last30: 12, thisMonth: 10, lastMonth: 10, thisYear: 9, custom: 9 }[dateRangePreset]}ch + 3.75rem)`, flex: 'none' }}
                >
                  <option value="any">Any Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last7">Last 7 Days</option>
                  <option value="last30">Last 30 Days</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="thisYear">This Year</option>
                  <option value="custom">Custom...</option>
                </select>
                {dateRangePreset === 'custom' && (
                  <>
                    <input
                      type="date"
                      value={dateStart}
                      onChange={(e) => setDateStart(e.target.value)}
                      style={{ flex: '1 1 0', minWidth: 'calc(10ch + 3.75rem)' }}
                    />
                    <span style={{ color: 'var(--text-tertiary)', flex: 'none' }}>to</span>
                    <input
                      type="date"
                      value={dateEnd}
                      onChange={(e) => setDateEnd(e.target.value)}
                      style={{ flex: '1 1 0', minWidth: 'calc(10ch + 3.75rem)' }}
                    />
                  </>
                )}
                {dateRangePreset !== 'any' && dateRangePreset !== 'custom' && (() => {
                  const range = getDateRangeFromPreset(dateRangePreset);
                  return (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      {range.start} to {range.end}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtered & Sorted Results */}
      {sortedTasks.length > 0 && (
        <div className="form-section">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-md)'
          }}>
            <h3 style={{ margin: 0 }}>
              Filtered & Sorted ({sortedTasks.length})
            </h3>

            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
              <select
                value={filteredPageSize}
                onChange={(e) => {
                  setFilteredPageSize(Number(e.target.value));
                  setFilteredPage(1);
                }}
                style={{ padding: 'var(--spacing-xs)', fontSize: '0.75rem' }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div style={{
            padding: 'var(--spacing-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            maxHeight: '500px',
            overflowY: 'auto'
          }}>
            {sortedTasks.slice((filteredPage - 1) * filteredPageSize, filteredPage * filteredPageSize).map((task, index) => (
              <div
                key={task.id}
                style={{
                  padding: 'var(--spacing-sm)',
                  marginBottom: 'var(--spacing-xs)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  gap: 'var(--spacing-md)',
                  alignItems: 'flex-start'
                }}
              >
                <div style={{
                  minWidth: '30px',
                  fontWeight: '700',
                  color: 'var(--accent-primary)',
                  fontSize: '0.75rem'
                }}>
                  {(filteredPage - 1) * filteredPageSize + index + 1}.
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: '600',
                    marginBottom: 'var(--spacing-xs)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {task.title}
                  </div>

                  {task.notes && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontStyle: 'italic',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      {task.notes}
                    </div>
                  )}

                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    gap: 'var(--spacing-md)',
                    flexWrap: 'wrap'
                  }}>
                    {task.due && (
                      <span>Due: {new Date(task.due).toLocaleDateString()}</span>
                    )}
                    {task.notes && parseDuration(task.notes) !== Infinity && (
                      <span>{formatDurationPreview(parseDuration(task.notes))}</span>
                    )}
                    {task.parent && (
                      <span style={{ color: 'var(--accent-warning, #ed8936)' }}>Subtask</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {sortedTasks.length > filteredPageSize && (() => {
              const totalPages = Math.ceil(sortedTasks.length / filteredPageSize);
              const startItem = (filteredPage - 1) * filteredPageSize + 1;
              const endItem = Math.min(filteredPage * filteredPageSize, sortedTasks.length);
              return (
                <div style={{
                  padding: 'var(--spacing-md)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem'
                }}>
                  <button
                    onClick={() => setFilteredPage(p => Math.max(1, p - 1))}
                    disabled={filteredPage === 1}
                    style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.75rem' }}
                  >
                    Prev
                  </button>
                  <span>
                    {startItem}-{endItem} of {sortedTasks.length} (Page {filteredPage}/{totalPages})
                  </span>
                  <button
                    onClick={() => setFilteredPage(p => Math.min(totalPages, p + 1))}
                    disabled={filteredPage === totalPages}
                    style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.75rem' }}
                  >
                    Next
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* No Results */}
      {allTasks.length > 0 && sortedTasks.length === 0 && (
        <div style={{
          padding: 'var(--spacing-lg)',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          No tasks match the current filters. Try adjusting your filter criteria.
        </div>
      )}
    </div>
  );
}

export default Tab10;
