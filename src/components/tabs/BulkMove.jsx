import { useState, useEffect, useCallback } from 'react';
import { taskAPI } from '../../utils/taskApi';
import FetchingIndicator from '../FetchingIndicator';

function BulkMove() {
  const [taskLists, setTaskLists] = useState([]);
  const [sourceList, setSourceList] = useState('');
  const [destinationList, setDestinationList] = useState('');
  const [loadingLists, setLoadingLists] = useState(true);

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [searchIn, setSearchIn] = useState('both'); // 'title', 'notes', 'both'
  const [searchLogic, setSearchLogic] = useState('AND'); // 'AND', 'OR'
  const [hasDueDate, setHasDueDate] = useState('either'); // 'yes', 'no', 'either'
  const [hasParent, setHasParent] = useState('either'); // 'yes', 'no', 'either'
  const [hasNotes, setHasNotes] = useState('either'); // 'yes', 'no', 'either'
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');

  // Results states
  const [allTasks, setAllTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  // Sort states
  const [sortBy, setSortBy] = useState('alphabetical'); // 'alphabetical', 'created', 'duration', 'dueDate'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc', 'desc'
  const [sortedTasks, setSortedTasks] = useState([]);

  // Preview/pagination states
  const [filteredPageSize, setFilteredPageSize] = useState(10);
  const [filteredPage, setFilteredPage] = useState(1);
  const [selectedPageSize, setSelectedPageSize] = useState(10);
  const [selectedPage, setSelectedPage] = useState(1);

  // Selection states
  const [selectedTasks, setSelectedTasks] = useState([]);

  // Processing states
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState(null);

  // Load task lists on mount
  useEffect(() => {
    loadTaskLists();
  }, []);

  // Auto-apply filters whenever filter criteria or allTasks change
  useEffect(() => {
    if (allTasks.length > 0) {
      handleApplyFilters();
    }
  }, [searchText, searchIn, searchLogic, hasDueDate, hasParent, hasNotes, dateRangeStart, dateRangeEnd, allTasks]);

  // Auto-apply sort whenever filtered tasks or sort criteria change
  useEffect(() => {
    handleApplySort();
  }, [filteredTasks, sortBy, sortDirection]);

  // Reset filtered page when sorted tasks change
  useEffect(() => {
    setFilteredPage(1);
  }, [sortedTasks]);

  // Reset selected page when selection changes significantly
  useEffect(() => {
    const maxPage = Math.ceil(selectedTasks.length / selectedPageSize) || 1;
    if (selectedPage > maxPage) {
      setSelectedPage(maxPage);
    }
  }, [selectedTasks.length, selectedPageSize, selectedPage]);

  async function loadTaskLists() {
    try {
      setLoadingLists(true);
      const lists = await taskAPI.getTaskLists();
      setTaskLists(lists);

      if (lists.length > 0) {
        setSourceList(lists[0].id);
      }
    } catch (error) {
      console.error('Failed to load task lists:', error);
      alert('Failed to load task lists: ' + error.message);
    } finally {
      setLoadingLists(false);
    }
  }

  async function handleFetchTasks(listId) {
    if (!listId) {
      alert('Please select a source task list');
      return;
    }

    try {
      setIsFetching(true);
      setAllTasks([]);
      setFilteredTasks([]);
      setSortedTasks([]);
      setResults(null);

      console.log('[BulkMove] Fetching all tasks from source list...');
      const tasks = await taskAPI.getAllTasksFromList(listId, false, false);

      // Filter out completed tasks automatically
      const activeTasks = tasks.filter(task => task.status !== 'completed');

      setAllTasks(activeTasks);
      console.log(`[BulkMove] Fetched ${activeTasks.length} active tasks`);

    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      alert('Failed to fetch tasks: ' + error.message);
    } finally {
      setIsFetching(false);
    }
  }

  const handleApplyFilters = useCallback(() => {
    console.log('[BulkMove] Applying filters...');

    let filtered = [...allTasks];

    // Search text filter
    if (searchText.trim()) {
      const terms = searchText.split(',').map(t => t.trim().toLowerCase()).filter(t => t);

      filtered = filtered.filter(task => {
        const titleText = task.title.toLowerCase();
        const notesText = (task.notes || '').toLowerCase();

        let searchTarget = '';
        if (searchIn === 'title') searchTarget = titleText;
        else if (searchIn === 'notes') searchTarget = notesText;
        else searchTarget = titleText + ' ' + notesText;

        if (searchLogic === 'AND') {
          return terms.every(term => searchTarget.includes(term));
        } else {
          return terms.some(term => searchTarget.includes(term));
        }
      });
    }

    // Has due date filter
    if (hasDueDate !== 'either') {
      filtered = filtered.filter(task => {
        const hasDue = !!task.due;
        return hasDueDate === 'yes' ? hasDue : !hasDue;
      });
    }

    // Has parent filter
    if (hasParent !== 'either') {
      filtered = filtered.filter(task => {
        const hasParentTask = !!task.parent;
        return hasParent === 'yes' ? hasParentTask : !hasParentTask;
      });
    }

    // Has notes filter
    if (hasNotes !== 'either') {
      filtered = filtered.filter(task => {
        const hasTaskNotes = !!(task.notes && task.notes.trim());
        return hasNotes === 'yes' ? hasTaskNotes : !hasTaskNotes;
      });
    }

    // Date range filter (creation date)
    if (dateRangeStart) {
      const startDate = new Date(dateRangeStart);
      filtered = filtered.filter(task => {
        if (!task.updated) return false;
        const taskDate = new Date(task.updated);
        return taskDate >= startDate;
      });
    }

    if (dateRangeEnd) {
      const endDate = new Date(dateRangeEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(task => {
        if (!task.updated) return false;
        const taskDate = new Date(task.updated);
        return taskDate <= endDate;
      });
    }

    setFilteredTasks(filtered);
    console.log(`[BulkMove] Filtered to ${filtered.length} tasks from ${allTasks.length} total`);
  }, [allTasks, searchText, searchIn, searchLogic, hasDueDate, hasParent, hasNotes, dateRangeStart, dateRangeEnd]);

  /**
   * Parse duration from notes string
   */
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

    console.log('[BulkMove] Applying sort...');

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
          return sortDirection === 'asc'
            ? dateA - dateB
            : dateB - dateA;
        });
        break;

      case 'duration':
        sorted.sort((a, b) => {
          const durA = parseDuration(a.notes);
          const durB = parseDuration(b.notes);
          return sortDirection === 'asc'
            ? durA - durB
            : durB - durA;
        });
        break;

      case 'dueDate':
        sorted.sort((a, b) => {
          const dueA = a.due ? new Date(a.due).getTime() : Infinity;
          const dueB = b.due ? new Date(b.due).getTime() : Infinity;
          return sortDirection === 'asc'
            ? dueA - dueB
            : dueB - dueA;
        });
        break;

      default:
        break;
    }

    setSortedTasks(sorted);
    console.log(`[BulkMove] Sorted ${sorted.length} tasks by ${sortBy} (${sortDirection})`);
  }, [filteredTasks, sortBy, sortDirection]);

  /**
   * Format seconds back to readable duration for display
   */
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

  function handleClear() {
    setSearchText('');
    setSearchIn('both');
    setSearchLogic('AND');
    setHasDueDate('either');
    setHasParent('either');
    setHasNotes('either');
    setDateRangeStart('');
    setDateRangeEnd('');
    setAllTasks([]);
    setFilteredTasks([]);
    setSortedTasks([]);
    setSelectedTasks([]);
    setResults(null);
    setProgress({ current: 0, total: 0 });
  }

  /**
   * Get task IDs to actually move (excludes subtasks whose parents are also selected)
   * This prevents 404 errors since subtasks automatically move with their parents
   */
  function getTasksToMove() {
    const selectedSet = new Set(selectedTasks);

    // Find subtasks whose parents are also selected
    const redundantSubtasks = new Set();
    for (const taskId of selectedTasks) {
      const task = allTasks.find(t => t.id === taskId);
      if (task?.parent && selectedSet.has(task.parent)) {
        redundantSubtasks.add(taskId);
      }
    }

    // Return only tasks that aren't redundant subtasks
    return selectedTasks.filter(id => !redundantSubtasks.has(id));
  }

  /**
   * Move selected tasks to destination list
   */
  async function handleMoveTasks() {
    if (!sourceList) {
      alert('Please select a source task list');
      return;
    }

    if (!destinationList) {
      alert('Please select a destination task list');
      return;
    }

    if (sourceList === destinationList) {
      alert('Source and destination lists must be different');
      return;
    }

    if (selectedTasks.length === 0) {
      alert('Please select at least one task to move');
      return;
    }

    try {
      setIsLoading(true);
      setResults(null);

      // Filter out subtasks whose parents are also selected (they'll move automatically)
      const tasksToMove = getTasksToMove();

      console.log(`[BulkMove] Moving ${tasksToMove.length} tasks from ${sourceList} to ${destinationList}...`);
      if (tasksToMove.length < selectedTasks.length) {
        console.log(`[BulkMove] Excluded ${selectedTasks.length - tasksToMove.length} subtasks (will move with parents)`);
      }

      setProgress({ current: 0, total: tasksToMove.length });

      // Perform bulk move
      const result = await taskAPI.bulkMoveTasks(
        sourceList,
        destinationList,
        tasksToMove,
        (current, total) => setProgress({ current, total }),
        true // stopOnFailure
      );

      // Show results
      setResults(result);

      // Refresh source list after moves complete
      if (result.successful.length > 0) {
        console.log('[BulkMove] Refreshing source list after moves...');

        // Remove successfully moved tasks AND their subtasks from local state
        const movedIds = new Set(result.successful.map(r => r.taskId));

        // Also find subtasks of moved parents
        const subtasksOfMoved = allTasks
          .filter(t => t.parent && movedIds.has(t.parent))
          .map(t => t.id);
        subtasksOfMoved.forEach(id => movedIds.add(id));

        setAllTasks(prev => prev.filter(t => !movedIds.has(t.id)));
        setSelectedTasks(prev => prev.filter(id => !movedIds.has(id)));
      }

    } catch (error) {
      console.error('Failed to move tasks:', error);
      alert('Failed to move tasks: ' + error.message);
    } finally {
      setIsLoading(false);
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

  const sourceListName = taskLists.find(l => l.id === sourceList)?.title || '';
  const destinationListName = taskLists.find(l => l.id === destinationList)?.title || '';

  // Calculate actual tasks to move (excluding redundant subtasks)
  const tasksToMoveCount = selectedTasks.length > 0 ? getTasksToMove().length : 0;
  const redundantSubtaskCount = selectedTasks.length - tasksToMoveCount;

  return (
    <div>
      <div className="tab-header">
        <h2>Bulk Move Tasks</h2>
        <p>
          Move multiple tasks between lists. Select a source list, filter tasks, then move them to a destination list.
        </p>
      </div>

      {/* Task List Selection */}
      <div className="form-section">
        <h3>Select Lists</h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label htmlFor="source-list">Source List</label>
            <select
              id="source-list"
              value={sourceList}
              onChange={(e) => {
                setSourceList(e.target.value);
                if (e.target.value) {
                  handleFetchTasks(e.target.value);
                }
              }}
              disabled={isLoading || isFetching}
            >
              <option value="">Select source list...</option>
              {taskLists.map(list => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label htmlFor="destination-list">Destination List</label>
            <select
              id="destination-list"
              value={destinationList}
              onChange={(e) => setDestinationList(e.target.value)}
              disabled={isLoading || isFetching}
            >
              <option value="">Select destination list...</option>
              {taskLists
                .filter(list => list.id !== sourceList)
                .map(list => (
                  <option key={list.id} value={list.id}>
                    {list.title}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {sourceList && destinationList && sourceList === destinationList && (
          <div style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            background: 'rgba(229, 62, 62, 0.1)',
            border: '1px solid var(--accent-error, #e53e3e)',
            borderRadius: 'var(--radius-md)',
            marginTop: 'var(--spacing-md)',
            fontSize: '0.875rem',
            color: 'var(--accent-error, #e53e3e)'
          }}>
            Source and destination lists must be different.
          </div>
        )}
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
              <label htmlFor="search-text">Search (comma-separated for multiple)</label>
              <input
                id="search-text"
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="e.g., video, tutorial"
                disabled={isLoading}
              />
            </div>

            {/* Search In */}
            <div className="form-group">
              <label htmlFor="search-in">Search In</label>
              <select
                id="search-in"
                value={searchIn}
                onChange={(e) => setSearchIn(e.target.value)}
                disabled={isLoading}
              >
                <option value="both">Both</option>
                <option value="title">Title</option>
                <option value="notes">Notes</option>
              </select>
            </div>

            {/* Search Logic */}
            <div className="form-group">
              <label htmlFor="search-logic">Logic</label>
              <select
                id="search-logic"
                value={searchLogic}
                onChange={(e) => setSearchLogic(e.target.value)}
                disabled={isLoading}
              >
                <option value="AND">AND (all)</option>
                <option value="OR">OR (any)</option>
              </select>
            </div>

            {/* Has Due Date */}
            <div className="form-group">
              <label htmlFor="has-due-date">Has Due Date</label>
              <select
                id="has-due-date"
                value={hasDueDate}
                onChange={(e) => setHasDueDate(e.target.value)}
                disabled={isLoading}
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
                disabled={isLoading}
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
                disabled={isLoading}
              >
                <option value="either">Either</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="form-group">
              <label htmlFor="date-range-start">Created After</label>
              <input
                id="date-range-start"
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="date-range-end">Created Before</label>
              <input
                id="date-range-end"
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Sort By */}
            <div className="form-group">
              <label htmlFor="sort-by">Sort By</label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                disabled={isLoading}
              >
                <option value="alphabetical">Alphabetical</option>
                <option value="created">Creation Date</option>
                <option value="duration">Duration (from notes)</option>
                <option value="dueDate">Current Due Date</option>
              </select>
            </div>

            {/* Sort Direction */}
            <div className="form-group">
              <label htmlFor="sort-direction">Direction</label>
              <select
                id="sort-direction"
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value)}
                disabled={isLoading}
              >
                <option value="asc">
                  {sortBy === 'alphabetical' ? 'A → Z' :
                   sortBy === 'created' ? 'Oldest First' :
                   sortBy === 'duration' ? 'Shortest First' :
                   sortBy === 'dueDate' ? 'Earliest First' : 'Ascending'}
                </option>
                <option value="desc">
                  {sortBy === 'alphabetical' ? 'Z → A' :
                   sortBy === 'created' ? 'Newest First' :
                   sortBy === 'duration' ? 'Longest First' :
                   sortBy === 'dueDate' ? 'Latest First' : 'Descending'}
                </option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Filtered & Sorted Results with Selection (Side by Side) */}
      {sortedTasks.length > 0 && (
        <div className="form-section">
          <div className="bulk-dates-grid">
            {/* Left: Filtered & Sorted Results */}
            <div>
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
                    disabled={isLoading}
                    style={{ padding: 'var(--spacing-xs)', fontSize: '0.75rem' }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <button
                    onClick={() => setSelectedTasks(sortedTasks.map(t => t.id))}
                    disabled={isLoading}
                    style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.75rem' }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedTasks([])}
                    disabled={isLoading || selectedTasks.length === 0}
                    style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.75rem' }}
                  >
                    Clear
                  </button>
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
                {sortedTasks.slice((filteredPage - 1) * filteredPageSize, filteredPage * filteredPageSize).map((task, index) => {
                  const isSelected = selectedTasks.includes(task.id);

                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTasks(prev => prev.filter(id => id !== task.id));
                        } else {
                          setSelectedTasks(prev => [...prev, task.id]);
                        }
                      }}
                      style={{
                        padding: 'var(--spacing-sm)',
                        marginBottom: 'var(--spacing-xs)',
                        background: isSelected ? 'rgba(49, 130, 206, 0.1)' : 'var(--bg-primary)',
                        border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        display: 'flex',
                        gap: 'var(--spacing-md)',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div style={{
                        minWidth: '20px',
                        height: '20px',
                        border: '2px solid var(--accent-primary)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        background: isSelected ? 'var(--accent-primary)' : 'transparent',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        marginTop: '2px'
                      }}>
                        {isSelected && '✓'}
                      </div>

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
                  );
                })}

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

            {/* Right: Selected Tasks */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-md)'
              }}>
                <h3 style={{ margin: 0 }}>
                  Selected Tasks ({selectedTasks.length})
                </h3>
                {selectedTasks.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                    <select
                      value={selectedPageSize}
                      onChange={(e) => {
                        setSelectedPageSize(Number(e.target.value));
                        setSelectedPage(1);
                      }}
                      disabled={isLoading}
                      style={{ padding: 'var(--spacing-xs)', fontSize: '0.75rem' }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <button
                      onClick={() => setSelectedTasks([])}
                      disabled={isLoading}
                      style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.75rem' }}
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              {selectedTasks.length > 0 ? (
                <div style={{
                  padding: 'var(--spacing-md)',
                  background: 'rgba(49, 130, 206, 0.05)',
                  border: '2px solid var(--accent-primary)',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '500px',
                  overflowY: 'auto'
                }}>
                  {sortedTasks
                    .filter(task => selectedTasks.includes(task.id))
                    .slice((selectedPage - 1) * selectedPageSize, selectedPage * selectedPageSize)
                    .map((task, index) => (
                      <div
                        key={task.id}
                        style={{
                          padding: 'var(--spacing-sm)',
                          marginBottom: 'var(--spacing-xs)',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--accent-primary)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem',
                          display: 'flex',
                          gap: 'var(--spacing-md)',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{
                          minWidth: '30px',
                          fontWeight: '700',
                          color: 'var(--accent-primary)',
                          fontSize: '0.75rem'
                        }}>
                          {(selectedPage - 1) * selectedPageSize + index + 1}.
                        </div>

                        <div style={{
                          flex: 1,
                          fontWeight: '600',
                          minWidth: 0,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {task.title}
                        </div>

                        <button
                          onClick={() => setSelectedTasks(prev => prev.filter(id => id !== task.id))}
                          style={{
                            padding: 'var(--spacing-xs)',
                            fontSize: '0.75rem',
                            background: 'transparent',
                            border: '1px solid var(--accent-error)',
                            color: 'var(--accent-error)',
                            cursor: 'pointer',
                            borderRadius: 'var(--radius-sm)',
                            flexShrink: 0
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                  {selectedTasks.length > selectedPageSize && (() => {
                    const totalPages = Math.ceil(selectedTasks.length / selectedPageSize);
                    const startItem = (selectedPage - 1) * selectedPageSize + 1;
                    const endItem = Math.min(selectedPage * selectedPageSize, selectedTasks.length);
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
                          onClick={() => setSelectedPage(p => Math.max(1, p - 1))}
                          disabled={selectedPage === 1}
                          style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.75rem' }}
                        >
                          Prev
                        </button>
                        <span>
                          {startItem}-{endItem} of {selectedTasks.length} (Page {selectedPage}/{totalPages})
                        </span>
                        <button
                          onClick={() => setSelectedPage(p => Math.min(totalPages, p + 1))}
                          disabled={selectedPage === totalPages}
                          style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.75rem' }}
                        >
                          Next
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{
                  padding: 'var(--spacing-xl)',
                  background: 'var(--bg-tertiary)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.875rem',
                  minHeight: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  No tasks selected. Click tasks on the left to select them.
                </div>
              )}
            </div>
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

      {/* Move Action */}
      {selectedTasks.length > 0 && destinationList && (
        <div className="form-section">
          <h3>Move Tasks</h3>

          <div style={{
            padding: 'var(--spacing-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-md)'
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Moving <strong>{tasksToMoveCount}</strong> task{tasksToMoveCount !== 1 ? 's' : ''} from{' '}
              <strong>{sourceListName}</strong> to <strong>{destinationListName}</strong>
              {redundantSubtaskCount > 0 && (
                <span style={{ color: 'var(--text-tertiary)' }}>
                  {' '}({redundantSubtaskCount} subtask{redundantSubtaskCount !== 1 ? 's' : ''} will move with parent{redundantSubtaskCount !== 1 ? 's' : ''})
                </span>
              )}
            </p>
            <p style={{ margin: 'var(--spacing-sm) 0 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Note: Subtasks automatically move with their parent tasks.
            </p>
          </div>

          <button
            className="primary"
            onClick={handleMoveTasks}
            disabled={isLoading || !destinationList || sourceList === destinationList || tasksToMoveCount === 0}
            style={{ width: '100%' }}
          >
            {isLoading
              ? 'Moving Tasks...'
              : `Move ${tasksToMoveCount} Task${tasksToMoveCount !== 1 ? 's' : ''} to ${destinationListName}`
            }
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      {isLoading && (
        <div className="form-section">
          <div className="progress-container">
            <div className="progress-header">
              <span className="progress-label">Moving Tasks...</span>
              <span className="progress-count">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="form-section">
          <div className="results-container">
            <div className="results-summary">
              <div className="result-stat">
                <span className="result-stat-value success">
                  {results.successful.length}
                </span>
                <span className="result-stat-label">Moved</span>
              </div>
              <div className="result-stat">
                <span className="result-stat-value error">
                  {results.failed.length}
                </span>
                <span className="result-stat-label">Failed</span>
              </div>
            </div>

            {results.successful.length > 0 && (
              <div style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'rgba(72, 187, 120, 0.1)',
                border: '1px solid var(--accent-success, #48bb78)',
                borderRadius: 'var(--radius-md)',
                marginTop: 'var(--spacing-md)',
                fontSize: '0.875rem',
                color: 'var(--accent-success, #48bb78)'
              }}>
                Successfully moved {results.successful.length} task{results.successful.length !== 1 ? 's' : ''} to {destinationListName}.
              </div>
            )}

            {results.failed.length > 0 && (
              <details className="results-details">
                <summary>View Failed Moves</summary>
                <div className="results-list">
                  {results.failed.map((item, index) => (
                    <div key={index} className="result-item error">
                      Task ID {item.taskId}: {item.error}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {results.stopped && (
              <div style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'rgba(237, 137, 54, 0.1)',
                border: '1px solid var(--accent-warning, #ed8936)',
                borderRadius: 'var(--radius-md)',
                marginTop: 'var(--spacing-md)',
                fontSize: '0.875rem',
                color: 'var(--accent-warning, #ed8936)'
              }}>
                Operation was stopped due to an error. Some tasks may not have been moved.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkMove;
