import { useState, useEffect } from 'react';
import { taskAPI } from '../../utils/taskApi';
import FetchingIndicator from '../FetchingIndicator';

function BulkSetNotes() {
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [taskTitles, setTaskTitles] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Load task lists on mount
  useEffect(() => {
    loadTaskLists();
  }, []);

  // Validate inputs whenever they change
  useEffect(() => {
    validateInputs();
  }, [taskTitles, taskNotes]);

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

  function validateInputs() {
    const titles = taskTitles.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const notes = taskNotes.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Check for duplicate tasks
    const uniqueTitles = new Set(titles);
    if (titles.length !== uniqueTitles.size) {
      setValidationError('Duplicate tasks detected in task list. Each task must be unique.');
      return false;
    }

    // Check if more notes than tasks
    if (notes.length > titles.length && titles.length > 0) {
      setValidationError(`Too many notes (${notes.length}) for tasks (${titles.length}). Notes cannot exceed tasks.`);
      return false;
    }

    setValidationError(null);
    return true;
  }

  function calculateEstimate(taskCount) {
    let delayPerTask;
    
    if (taskCount > 1000) {
      delayPerTask = 1000;
    } else if (taskCount > 500) {
      delayPerTask = 750;
    } else if (taskCount > 100) {
      delayPerTask = 350;
    } else {
      delayPerTask = 100;
    }
    
    const totalMs = taskCount * delayPerTask * 1.2;
    const totalSeconds = Math.ceil(totalMs / 1000);
    
    return {
      seconds: totalSeconds,
      formatted: formatEstimatedTime(totalSeconds)
    };
  }

  function formatEstimatedTime(seconds) {
    if (seconds < 60) {
      return `~${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `~${minutes}m ${secs}s` : `~${minutes} minutes`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `~${hours}h ${minutes}m` : `~${hours} hours`;
    }
  }

  async function handleBulkSetNotes() {
    // Validation
    if (!selectedList) {
      alert('Please select a task list');
      return;
    }

    if (!taskTitles.trim()) {
      alert('Please enter at least one task title');
      return;
    }

    if (!taskNotes.trim()) {
      alert('Please enter at least one note');
      return;
    }

    if (!validateInputs()) {
      return;
    }

    // Parse inputs
    const titles = taskTitles.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const notes = taskNotes.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    try {
      setIsLoading(true);
      setIsFetching(true);
      setProgress({ current: 0, total: titles.length });
      setResults(null);

      // First, get ALL tasks from the selected list (with pagination)
      console.log('[BulkSetNotes] Fetching all tasks from list...');
      const allTasks = await taskAPI.getAllTasksFromList(selectedList, false, false);
      
      setIsFetching(false);

      // Create a map of task titles to task objects
      const taskMap = new Map();
      allTasks.forEach(task => {
        taskMap.set(task.title.trim(), task);
      });

      // Match titles to tasks and prepare updates
      const updates = [];
      const notFound = [];

      titles.forEach((title, index) => {
        const task = taskMap.get(title);
        if (task) {
          // Get corresponding note (or empty string if fewer notes than tasks)
          const note = notes[index] || '';
          updates.push({
            taskId: task.id,
            taskTitle: title,
            updates: { notes: note }
          });
        } else {
          notFound.push(title);
        }
      });

      console.log(`[BulkSetNotes] Found ${updates.length} tasks to update, ${notFound.length} not found`);

      // Perform bulk update
      const result = await taskAPI.bulkUpdateTasks(
        selectedList,
        updates,
        (current, total) => setProgress({ current, total })
      );

      // Add not found tasks to results
      result.notFound = notFound;

      // Show results
      setResults(result);

      // Clear input on success if all succeeded and all found
      if (result.failed.length === 0 && notFound.length === 0) {
        setTaskTitles('');
        setTaskNotes('');
      }

    } catch (error) {
      console.error('Bulk set notes failed:', error);
      alert('Bulk set notes failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setTaskTitles('');
    setTaskNotes('');
    setResults(null);
    setProgress({ current: 0, total: 0 });
    setValidationError(null);
  }

  if (loadingLists) {
    return (
      <div className="tab-content">
        <div className="spinner"></div>
        <p className="text-center">Loading task lists...</p>
      </div>
    );
  }

  // Calculate counts
  const taskCount = taskTitles.split('\n').filter(l => l.trim()).length;
  const noteCount = taskNotes.split('\n').filter(l => l.trim()).length;
  const estimate = taskCount > 0 ? calculateEstimate(taskCount) : null;

  // Check if process button should be disabled
  const canProcess = selectedList && 
                     taskCount > 0 && 
                     noteCount > 0 && 
                     !validationError &&
                     !isLoading;

  return (
    <div>
      <div className="tab-header">
        <h2>Bulk Set Notes</h2>
        <p>
          Set notes on multiple tasks at once. Match task titles (left) with their corresponding notes (right).
          Tasks will be matched by exact title.
        </p>
      </div>

      <div className="form-section">
        <h3>Select Task List</h3>
        <div className="form-group">
          <label htmlFor="task-list">Task List</label>
          <select
            id="task-list"
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
            disabled={isLoading}
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

      <div className="form-section">
        <h3>Tasks and Notes</h3>
        <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="form-group">
            <label htmlFor="task-titles">
              Task Titles ({taskCount} task{taskCount !== 1 ? 's' : ''})
              {estimate && taskCount > 10 && (
                <span style={{ color: 'var(--accent-primary)', marginLeft: 'var(--spacing-sm)' }}>
                  · Est: {estimate.formatted}
                </span>
              )}
            </label>
            <textarea
              id="task-titles"
              value={taskTitles}
              onChange={(e) => setTaskTitles(e.target.value)}
              placeholder="Task Title 1&#10;Task Title 2&#10;Task Title 3"
              rows={12}
              disabled={isLoading}
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-notes">
              Notes ({noteCount} note{noteCount !== 1 ? 's' : ''})
            </label>
            <textarea
              id="task-notes"
              value={taskNotes}
              onChange={(e) => setTaskNotes(e.target.value)}
              placeholder="Note for Task 1&#10;Note for Task 2&#10;Note for Task 3"
              rows={12}
              disabled={isLoading}
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
            />
          </div>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div style={{
            padding: 'var(--spacing-md)',
            background: 'rgba(229, 62, 62, 0.1)',
            border: '1px solid var(--accent-error)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-error)',
            fontSize: '0.875rem',
            marginTop: 'var(--spacing-md)'
          }}>
            ⚠️ {validationError}
          </div>
        )}

        {/* Info: Fewer notes than tasks is OK */}
        {taskCount > noteCount && noteCount > 0 && !validationError && (
          <div style={{
            padding: 'var(--spacing-md)',
            background: 'rgba(221, 107, 32, 0.1)',
            border: '1px solid var(--accent-warning)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-warning)',
            fontSize: '0.875rem',
            marginTop: 'var(--spacing-md)'
          }}>
            ℹ️ {taskCount - noteCount} task{taskCount - noteCount !== 1 ? 's' : ''} will have empty notes.
          </div>
        )}
      </div>

      {/* Time Estimate Card */}
      {taskCount > 50 && !isLoading && !results && canProcess && (
        <div style={{
          padding: 'var(--spacing-lg)',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <h3 style={{ 
            fontSize: '0.875rem', 
            marginBottom: 'var(--spacing-sm)',
            color: 'var(--text-secondary)'
          }}>
            ⏱️ Estimated Time
          </h3>
          <p style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700',
            color: 'var(--accent-primary)',
            margin: 0 
          }}>
            {estimate.formatted}
          </p>
          <p style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-tertiary)',
            marginTop: 'var(--spacing-xs)',
            marginBottom: 0
          }}>
            for {taskCount} tasks ({taskCount < 100 ? 'fast' : taskCount < 500 ? 'moderate' : 'conservative'} rate)
          </p>
        </div>
      )}

{/* Fetching Indicator */}
      {isFetching && (
        <FetchingIndicator 
          message="Fetching Tasks from List..."
          subMessage="Loading all tasks (this may take a moment for large lists)"
        />
      )}

      {/* Progress Indicator */}
      {isLoading && !isFetching && (
        <div className="progress-container">
          <div className="progress-header">
            <span className="progress-label">Setting Notes...</span>
            <span className="progress-count">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Display */}
  {results && (
        <div className="results-container">
          {/* Stopped Warning */}
          {results.stopped && (
            <div style={{
              padding: 'var(--spacing-md)',
              background: 'rgba(229, 62, 62, 0.15)',
              border: '2px solid var(--accent-error)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-error)',
              fontSize: '0.875rem',
              marginBottom: 'var(--spacing-lg)',
              fontWeight: '700'
            }}>
              ⚠️ Processing stopped after task failure. {results.successful.length} task(s) were updated before the failure.
            </div>
          )}
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
            {results.notFound && results.notFound.length > 0 && (
              <div className="result-stat">
                <span className="result-stat-value" style={{ color: 'var(--accent-warning)' }}>
                  {results.notFound.length}
                </span>
                <span className="result-stat-label">Not Found</span>
              </div>
            )}
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

          {results.notFound && results.notFound.length > 0 && (
            <details className="results-details">
              <summary>View Tasks Not Found</summary>
              <div className="results-list">
                {results.notFound.map((title, index) => (
                  <div key={index} className="result-item" style={{ borderLeftColor: 'var(--accent-warning)', color: 'var(--accent-warning)' }}>
                    {title}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="form-actions">
<button
          className="primary"
          onClick={handleBulkSetNotes}
          disabled={!canProcess || isFetching}
          title={!canProcess && validationError ? validationError : ''}
        >
          {isFetching ? 'Fetching Tasks...' : isLoading ? 'Setting Notes...' : 'Set Notes'}
        </button>
        <button
          onClick={handleClear}
          disabled={isLoading}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default BulkSetNotes;