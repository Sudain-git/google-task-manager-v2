import { useState, useEffect } from 'react';
import { taskAPI } from '../../utils/taskApi';
import FetchingIndicator from '../FetchingIndicator';

function BulkSetDates() {
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
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
  
  // Preview states
  const [previewLimit, setPreviewLimit] = useState(10);
  
  // Due date assignment states
  const [startDate, setStartDate] = useState('');
  const [frequency, setFrequency] = useState('same'); // 'same', 'interval', 'weekdays'
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

  async function handleFetchTasks() {
    if (!selectedList) {
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
      const tasks = await taskAPI.getAllTasksFromList(selectedList, false, false);
      
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

  function handleApplyFilters() {
    // TODO: Implement in Phase 2
    console.log('[BulkSetDates] Applying filters...');
    alert('Filter logic will be implemented in Phase 2!');
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
            onChange={(e) => setSelectedList(e.target.value)}
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
        
        <button
          onClick={handleFetchTasks}
          disabled={!selectedList || isLoading || isFetching}
          style={{ marginTop: 'var(--spacing-md)' }}
        >
          {isFetching ? 'Loading Tasks...' : 'Load Tasks'}
        </button>
      </div>

      {/* Fetching Indicator */}
      {isFetching && (
        <FetchingIndicator 
          message="Fetching Tasks from List..."
          subMessage="Loading all active tasks (excluding completed)"
        />
      )}

      {/* Filter Section */}
      {allTasks.length > 0 && (
        <div className="form-section">
          <h3>Filter Tasks ({allTasks.length} active tasks)</h3>
          
          {/* Search Text */}
          <div className="form-group">
            <label htmlFor="search-text">Search Text (separate terms with commas for multiple)</label>
            <input
              id="search-text"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="e.g., video, tutorial"
              disabled={isLoading}
            />
          </div>

          {/* Search Options */}
          <div className="form-row">
            <div className="form-group">
              <label>Search In</label>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', textTransform: 'none' }}>
                  <input
                    type="radio"
                    name="searchIn"
                    value="title"
                    checked={searchIn === 'title'}
                    onChange={(e) => setSearchIn(e.target.value)}
                    disabled={isLoading}
                  />
                  Title
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', textTransform: 'none' }}>
                  <input
                    type="radio"
                    name="searchIn"
                    value="notes"
                    checked={searchIn === 'notes'}
                    onChange={(e) => setSearchIn(e.target.value)}
                    disabled={isLoading}
                  />
                  Notes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', textTransform: 'none' }}>
                  <input
                    type="radio"
                    name="searchIn"
                    value="both"
                    checked={searchIn === 'both'}
                    onChange={(e) => setSearchIn(e.target.value)}
                    disabled={isLoading}
                  />
                  Both
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Search Logic (for multiple terms)</label>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', textTransform: 'none' }}>
                  <input
                    type="radio"
                    name="searchLogic"
                    value="AND"
                    checked={searchLogic === 'AND'}
                    onChange={(e) => setSearchLogic(e.target.value)}
                    disabled={isLoading}
                  />
                  AND (all terms)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', textTransform: 'none' }}>
                  <input
                    type="radio"
                    name="searchLogic"
                    value="OR"
                    checked={searchLogic === 'OR'}
                    onChange={(e) => setSearchLogic(e.target.value)}
                    disabled={isLoading}
                  />
                  OR (any term)
                </label>
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date-range-start">Created After (optional)</label>
              <input
                id="date-range-start"
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="date-range-end">Created Before (optional)</label>
              <input
                id="date-range-end"
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Boolean Filters */}
          <div className="form-row">
            <div className="form-group">
              <label>Has Due Date</label>
              <select
                value={hasDueDate}
                onChange={(e) => setHasDueDate(e.target.value)}
                disabled={isLoading}
              >
                <option value="either">Either</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div className="form-group">
              <label>Has Parent Task</label>
              <select
                value={hasParent}
                onChange={(e) => setHasParent(e.target.value)}
                disabled={isLoading}
              >
                <option value="either">Either</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div className="form-group">
              <label>Has Notes</label>
              <select
                value={hasNotes}
                onChange={(e) => setHasNotes(e.target.value)}
                disabled={isLoading}
              >
                <option value="either">Either</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          {/* Apply Filters Button */}
          <button
            onClick={handleApplyFilters}
            disabled={isLoading}
            className="primary"
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            Apply Filters
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="form-actions">
        <button
          onClick={handleClear}
          disabled={isLoading}
        >
          Clear All
        </button>
      </div>
    </div>
  );
}

export default BulkSetDates;