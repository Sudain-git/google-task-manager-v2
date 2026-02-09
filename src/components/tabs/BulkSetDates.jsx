import { useState, useEffect, useCallback } from 'react';
import { taskAPI } from '../../utils/taskApi';
import FetchingIndicator from '../FetchingIndicator';

function BulkSetDates() {
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [loadingLists, setLoadingLists] = useState(true);
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [searchIn, setSearchIn] = useState('title'); // 'title', 'notes', 'both'
  const [hasDueDate, setHasDueDate] = useState('either'); // 'yes', 'no', 'either'
  const [hasParent, setHasParent] = useState('either'); // 'yes', 'no', 'either'
  const [hasNotes, setHasNotes] = useState('either'); // 'yes', 'no', 'either'
  const [dateRangeType, setDateRangeType] = useState('created'); // 'created', 'due'
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  
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

  // Due date assignment states
  const [startDate, setStartDate] = useState('');
  const [frequency, setFrequency] = useState('interval'); // 'same', 'interval'
  const [intervalAmount, setIntervalAmount] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState('days'); // 'days', 'weeks', 'months'
  
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
  }, [searchText, searchIn, hasDueDate, hasParent, hasNotes, dateRangeType, dateStart, dateEnd, allTasks]);

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
        setSelectedList(lists[0].id);
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
      alert('Please select a task list');
      return;
    }

    try {
      setIsFetching(true);
      setAllTasks([]);
      setFilteredTasks([]);
      setSortedTasks([]);
      setResults(null);

      console.log('[BulkSetDates] Fetching all tasks from list...');
      const tasks = await taskAPI.getAllTasksFromList(listId, false, false);
      
      // Filter out completed tasks automatically
      const activeTasks = tasks.filter(task => task.status !== 'completed');
      
      setAllTasks(activeTasks);
      console.log(`[BulkSetDates] Fetched ${activeTasks.length} active tasks`);

    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      alert('Failed to fetch tasks: ' + error.message);
    } finally {
      setIsFetching(false);
    }
  }

/**
   * Evaluate search expression with && and || operators
   * Supports: "term1 && term2", "term1 || term2", "term1, term2" (comma = AND)
   * Mixed operators evaluated left-to-right
   */
  function evaluateSearchExpression(expression, target) {
    // First, normalize commas to && (commas mean AND)
    let normalized = expression.replace(/,/g, '&&');

    // Split by || first (lower precedence)
    const orParts = normalized.split('||').map(p => p.trim()).filter(p => p);

    if (orParts.length === 0) return true;

    // For each OR part, check if ALL AND terms match
    return orParts.some(orPart => {
      const andTerms = orPart.split('&&').map(t => t.trim()).filter(t => t);
      if (andTerms.length === 0) return true;
      return andTerms.every(term => target.includes(term));
    });
  }

const handleApplyFilters = useCallback(() => {
    console.log('[BulkSetDates] Applying filters...');

    let filtered = [...allTasks];

    // Search text filter
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

    // Date range filter (based on selected type)
    if (dateStart) {
      const startDate = new Date(dateStart);
      filtered = filtered.filter(task => {
        const field = dateRangeType === 'due' ? task.due : task.updated;
        if (!field) return false;
        return new Date(field) >= startDate;
      });
    }

    if (dateEnd) {
      const endDate = new Date(dateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(task => {
        const field = dateRangeType === 'due' ? task.due : task.updated;
        if (!field) return false;
        return new Date(field) <= endDate;
      });
    }

    setFilteredTasks(filtered);
    console.log(`[BulkSetDates] Filtered to ${filtered.length} tasks from ${allTasks.length} total`);
  }, [allTasks, searchText, searchIn, hasDueDate, hasParent, hasNotes, dateRangeType, dateStart, dateEnd]);


  /**
   * Parse duration from notes string
   * Examples: "43 sec" -> 43, "7 min" -> 420, "1 hour 15 min" -> 4500
   * Returns seconds, or Infinity if no duration found
   */
  function parseDuration(notes) {
    if (!notes) return Infinity;
    
    const noteText = notes.toLowerCase();
    
    // Match patterns like "43 sec", "7 min", "1 hour 15 min"
    const hourMatch = noteText.match(/(\d+)\s*hour/);
    const minMatch = noteText.match(/(\d+)\s*min/);
    const secMatch = noteText.match(/(\d+)\s*sec/);
    
    let totalSeconds = 0;
    
    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    if (secMatch) totalSeconds += parseInt(secMatch[1]);
    
    // If no duration found, return Infinity (will sort to end)
    return totalSeconds > 0 ? totalSeconds : Infinity;
  }

const handleApplySort = useCallback(() => {
    if (filteredTasks.length === 0) {
      setSortedTasks([]);
      return;
    }

    console.log('[BulkSetDates] Applying sort...');
    
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
    console.log(`[BulkSetDates] Sorted ${sorted.length} tasks by ${sortBy} (${sortDirection})`);
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
    setSearchIn('title');
    setHasDueDate('either');
    setHasParent('either');
    setHasNotes('either');
    setDateRangeType('created');
    setDateStart('');
    setDateEnd('');
    setAllTasks([]);
    setFilteredTasks([]);
    setSortedTasks([]);
    setSelectedTasks([]);
    setResults(null);
    setProgress({ current: 0, total: 0 });
  }

  if (loadingLists) {
    return (
      <div className="tab-content">
        <div className="spinner"></div>
        <p className="text-center">Loading task lists...</p>
      </div>
    );
  }

  /**
   * Calculate due date for a task based on frequency settings
   */
  function calculateDueDate(startDateStr, taskIndex, freq, amount, unit) {
    // Parse date string as local date to avoid timezone issues
    const [year, month, day] = startDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (freq === 'same') {
      // All tasks get the same date
      return date;
    } else if (freq === 'interval') {
      // Add interval * taskIndex
      const totalAmount = amount * taskIndex;

      if (unit === 'days') {
        date.setDate(date.getDate() + totalAmount);
      } else if (unit === 'weekdays') {
        // First, move start date to a weekday if it's on a weekend
        let dayOfWeek = date.getDay();
        while (dayOfWeek === 0 || dayOfWeek === 6) {
          date.setDate(date.getDate() + 1);
          dayOfWeek = date.getDay();
        }
        // Then add totalAmount weekdays
        let weekdaysAdded = 0;
        while (weekdaysAdded < totalAmount) {
          date.setDate(date.getDate() + 1);
          dayOfWeek = date.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            weekdaysAdded++;
          }
        }
      } else if (unit === 'weeks') {
        date.setDate(date.getDate() + (totalAmount * 7));
      } else if (unit === 'months') {
        date.setMonth(date.getMonth() + totalAmount);
      }

      return date;
    }

    return date;
  }

  /**
   * Apply due dates to selected tasks
   */
  async function handleApplyDueDates() {
    if (frequency !== 'clear' && !startDate) {
      alert('Please select a start date');
      return;
    }

    if (selectedTasks.length === 0) {
      alert('Please select at least one task');
      return;
    }

    try {
      setIsLoading(true);
      setResults(null);

      // Get selected tasks in sorted order
      const tasksToUpdate = sortedTasks.filter(task => selectedTasks.includes(task.id));

      let updates;
      if (frequency === 'clear') {
        // Only clear tasks that have a due date
        const tasksWithDueDate = tasksToUpdate.filter(task => task.due);
        console.log(`[BulkSetDates] Clearing due dates from ${tasksWithDueDate.length} tasks...`);

        setProgress({ current: 0, total: tasksWithDueDate.length });

        updates = tasksWithDueDate.map(task => ({
          taskId: task.id,
          updates: {
            due: null
          }
        }));
      } else {
        console.log('[BulkSetDates] Applying due dates...');
        setProgress({ current: 0, total: tasksToUpdate.length });

        // Prepare updates with calculated due dates
        updates = tasksToUpdate.map((task, index) => {
          const dueDate = calculateDueDate(startDate, index, frequency, intervalAmount, intervalUnit);

          return {
            taskId: task.id,
            updates: {
              due: dueDate.toISOString()
            }
          };
        });
      }

      console.log(`[BulkSetDates] Prepared ${updates.length} due date updates`);

      // Perform bulk update
      const result = await taskAPI.bulkUpdateTasks(
        selectedList,
        updates,
        (current, total) => setProgress({ current, total }),
        true // stopOnFailure
      );

      // Show results
      setResults(result);

      // Clear selection on success
      if (result.failed.length === 0 && !result.stopped) {
        setSelectedTasks([]);
        setStartDate('');
      }

    } catch (error) {
      console.error('Failed to apply due dates:', error);
      alert('Failed to apply due dates: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <div className="tab-header">
        <h2>Bulk Set Due Dates</h2>
        <p>
          Filter, sort, and assign due dates to multiple tasks with flexible scheduling options.
        </p>
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
            disabled={isLoading || isFetching}
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
                disabled={isLoading}
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
            <div className="form-group">
              <label>Date Range</label>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                <select
                  value={dateRangeType}
                  onChange={(e) => { setDateRangeType(e.target.value); setDateStart(''); setDateEnd(''); }}
                  disabled={isLoading}
                  style={{ width: 'auto', minWidth: '130px' }}
                >
                  <option value="created">Created</option>
                  <option value="due">Due</option>
                </select>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  disabled={isLoading}
                  style={{ flex: 1 }}
                />
                <span style={{ color: 'var(--text-tertiary)' }}>to</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  disabled={isLoading}
                  style={{ flex: 1 }}
                />
              </div>
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
                            <span>📅 {new Date(task.due).toLocaleDateString()}</span>
                          )}
                          {task.notes && parseDuration(task.notes) !== Infinity && (
                            <span>⏱️ {formatDurationPreview(parseDuration(task.notes))}</span>
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

{/* Right: Selected Tasks (Always visible) */}
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

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: '600',
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
                              marginTop: 'var(--spacing-xs)'
                            }}>
                              {task.notes}
                            </div>
                          )}
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
      
      {/* Due Date Assignment */}
      {selectedTasks.length > 0 && (
        <div className="form-section">
          <h3>Assign Due Dates ({selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''})</h3>
          
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-md)',
            justifyContent: 'space-between'
          }}>
            {/* Start Date */}
            <div className="form-group">
              <label htmlFor="start-date">Start Date</label>
              <input
                id="start-date"
                type="date"
                value={frequency === 'clear' ? '' : startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isLoading || frequency === 'clear'}
              />
            </div>

            {/* Frequency Type */}
            <div className="form-group">
              <label htmlFor="frequency">Frequency</label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                disabled={isLoading}
              >
                <option value="same">Same date for all</option>
                <option value="interval">Interval</option>
                <option value="clear">Clear due date</option>
              </select>
            </div>

            {/* Interval Amount */}
            <div className="form-group">
              <label htmlFor="interval-amount">Every</label>
              <input
                id="interval-amount"
                type="number"
                min="0"
                value={frequency === 'same' || frequency === 'clear' ? 0 : intervalAmount}
                onChange={(e) => setIntervalAmount(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isLoading || frequency === 'same' || frequency === 'clear'}
                style={{ width: '60px' }}
              />
            </div>

            {/* Interval Unit */}
            <div className="form-group">
              <label htmlFor="interval-unit">Unit</label>
              <select
                id="interval-unit"
                value={frequency === 'same' || frequency === 'clear' ? 'days' : intervalUnit}
                onChange={(e) => setIntervalUnit(e.target.value)}
                disabled={isLoading || frequency === 'same' || frequency === 'clear'}
              >
                <option value="days">Days</option>
                <option value="weekdays">Weekdays</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>

          {/* Weekend Start Date Notice */}
          {startDate && frequency !== 'clear' && intervalUnit === 'weekdays' && (() => {
            const [year, month, day] = startDate.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              // Find next Monday
              const nextMonday = new Date(date);
              while (nextMonday.getDay() !== 1) {
                nextMonday.setDate(nextMonday.getDate() + 1);
              }
              return (
                <div style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'rgba(237, 137, 54, 0.1)',
                  border: '1px solid var(--accent-warning, #ed8936)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-md)',
                  fontSize: '0.875rem',
                  color: 'var(--accent-warning, #ed8936)'
                }}>
                  Start date falls on a weekend. First task will be assigned to Monday {nextMonday.toLocaleDateString()}.
                </div>
              );
            }
            return null;
          })()}

          {/* Preview Due Dates */}
          {(startDate || frequency === 'clear') && (
            <div style={{
              padding: 'var(--spacing-md)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-md)'
            }}>
              <h4 style={{
                fontSize: '0.875rem',
                marginBottom: 'var(--spacing-sm)',
                color: 'var(--text-secondary)'
              }}>
                {frequency === 'clear' ? 'Tasks with due dates to clear (first 5)' : 'Preview Due Dates (first 5 tasks)'}
              </h4>

              {frequency === 'clear' ? (
                <>
                  {(() => {
                    const tasksWithDueDate = sortedTasks
                      .filter(task => selectedTasks.includes(task.id) && task.due);
                    return (
                      <>
                        {tasksWithDueDate.slice(0, 5).map((task, index) => (
                          <div
                            key={task.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: 'var(--spacing-xs)',
                              marginBottom: 'var(--spacing-xs)',
                              fontSize: '0.875rem'
                            }}
                          >
                            <span style={{
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginRight: 'var(--spacing-md)'
                            }}>
                              {index + 1}. {task.title}
                            </span>
                            <span style={{
                              fontWeight: '700',
                              color: 'var(--accent-error, #e53e3e)'
                            }}>
                              {new Date(task.due).toLocaleDateString()} → (clear)
                            </span>
                          </div>
                        ))}
                        {tasksWithDueDate.length > 5 && (
                          <div style={{
                            textAlign: 'center',
                            color: 'var(--text-tertiary)',
                            fontSize: '0.75rem',
                            marginTop: 'var(--spacing-sm)'
                          }}>
                            ... and {tasksWithDueDate.length - 5} more task{tasksWithDueDate.length - 5 !== 1 ? 's' : ''}
                          </div>
                        )}
                        {tasksWithDueDate.length === 0 && (
                          <div style={{
                            textAlign: 'center',
                            color: 'var(--text-tertiary)',
                            fontSize: '0.875rem',
                            padding: 'var(--spacing-md)'
                          }}>
                            No selected tasks have due dates to clear.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  {sortedTasks
                    .filter(task => selectedTasks.includes(task.id))
                    .slice(0, 5)
                    .map((task, index) => {
                      const dueDate = calculateDueDate(startDate, index, frequency, intervalAmount, intervalUnit);
                      return (
                        <div
                          key={task.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 'var(--spacing-xs)',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: '0.875rem'
                          }}
                        >
                          <span style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginRight: 'var(--spacing-md)'
                          }}>
                            {index + 1}. {task.title}
                          </span>
                          <span style={{
                            fontWeight: '700',
                            color: 'var(--accent-primary)'
                          }}>
                            → {dueDate.toLocaleDateString()}
                          </span>
                        </div>
                      );
                    })}

                  {selectedTasks.length > 5 && (
                    <div style={{
                      textAlign: 'center',
                      color: 'var(--text-tertiary)',
                      fontSize: '0.75rem',
                      marginTop: 'var(--spacing-sm)'
                    }}>
                      ... and {selectedTasks.length - 5} more task{selectedTasks.length - 5 !== 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Apply Button */}
          <button
            className="primary"
            onClick={handleApplyDueDates}
            disabled={(frequency !== 'clear' && !startDate) || isLoading}
            style={{ width: '100%' }}
          >
            {isLoading
              ? (frequency === 'clear' ? 'Clearing Due Dates...' : 'Applying Due Dates...')
              : (frequency === 'clear'
                  ? `Clear Due Dates from ${sortedTasks.filter(t => selectedTasks.includes(t.id) && t.due).length} Task${sortedTasks.filter(t => selectedTasks.includes(t.id) && t.due).length !== 1 ? 's' : ''}`
                  : `Apply Due Dates to ${selectedTasks.length} Task${selectedTasks.length !== 1 ? 's' : ''}`
                )
            }
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      {isLoading && (
        <div className="form-section">
          <div className="progress-container">
            <div className="progress-header">
              <span className="progress-label">{frequency === 'clear' ? 'Clearing Due Dates...' : 'Applying Due Dates...'}</span>
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
                <span className="result-stat-label">Successful</span>
              </div>
              <div className="result-stat">
                <span className="result-stat-value error">
                  {results.failed.length}
                </span>
                <span className="result-stat-label">Failed</span>
              </div>
            </div>

            {results.failed.length > 0 && (
              <details className="results-details">
                <summary>View Failed Updates</summary>
                <div className="results-list">
                  {results.failed.map((item, index) => (
                    <div key={index} className="result-item error">
                      {item.taskId}: {item.error}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

    </div>
  );
}


export default BulkSetDates;