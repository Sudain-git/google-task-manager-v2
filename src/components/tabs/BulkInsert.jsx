import { useState, useEffect } from 'react';
import { taskAPI } from '../../utils/taskApi';

function BulkInsert() {
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [taskTitles, setTaskTitles] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
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
      
      // Auto-select first list
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

  function calculateEstimate(taskCount) {
    let delayPerTask;
    
    if (taskCount < 100) {
      delayPerTask = 100; // 100ms
    } else if (taskCount < 500) {
      delayPerTask = 250; // 250ms
    } else {
      delayPerTask = 500; // 500ms
    }
    
    // Add 10% buffer for API overhead and potential retries
    const totalMs = taskCount * delayPerTask * 1.1;
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

  async function handleBulkInsert() {
    // Validation
    if (!selectedList) {
      alert('Please select a task list');
      return;
    }

    if (!taskTitles.trim()) {
      alert('Please enter at least one task title');
      return;
    }

    // Parse task titles (one per line)
    const titles = taskTitles
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (titles.length === 0) {
      alert('No valid task titles found');
      return;
    }

    try {
      setIsLoading(true);
      setProgress({ current: 0, total: titles.length });
      setResults(null);

      // Create task objects
      const tasks = titles.map(title => ({ title }));

      // Bulk insert with progress tracking
      const result = await taskAPI.bulkInsertTasks(
        selectedList,
        tasks,
        (current, total) => setProgress({ current, total })
      );

      // Show results
      setResults(result);

      // Clear input on success if all succeeded
      if (result.failed.length === 0) {
        setTaskTitles('');
      }

    } catch (error) {
      console.error('Bulk insert failed:', error);
      alert('Bulk insert failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setTaskTitles('');
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

  // Calculate current task count and estimate
  const taskCount = taskTitles.split('\n').filter(l => l.trim()).length;
  const estimate = taskCount > 0 ? calculateEstimate(taskCount) : null;

  return (
    <div>
      <div className="tab-header">
        <h2>Bulk Insert Tasks</h2>
        <p>
          Insert multiple tasks at once. Enter one task title per line.
          Tasks will be inserted in the order they appear.
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
        <h3>Task Titles</h3>
        <div className="form-group">
          <label htmlFor="task-titles">
            One task title per line ({taskCount} task{taskCount !== 1 ? 's' : ''})
            {estimate && taskCount > 10 && (
              <span style={{ color: 'var(--accent-primary)', marginLeft: 'var(--spacing-sm)' }}>
                · Estimated time: {estimate.formatted}
              </span>
            )}
          </label>
          <textarea
            id="task-titles"
            value={taskTitles}
            onChange={(e) => setTaskTitles(e.target.value)}
            placeholder="Buy groceries&#10;Call dentist&#10;Review project proposal&#10;Schedule team meeting"
            rows={12}
            disabled={isLoading}
            style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>

      {/* Time Estimate Card */}
      {taskCount > 50 && !isLoading && !results && (
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

      {/* Progress Indicator */}
      {isLoading && (
        <div className="progress-container">
          <div className="progress-header">
            <span className="progress-label">Inserting Tasks...</span>
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
              <summary>View Failed Tasks</summary>
              <div className="results-list">
                {results.failed.map((item, index) => (
                  <div key={index} className="result-item error">
                    {item.task.title}: {item.error}
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
          onClick={handleBulkInsert}
          disabled={isLoading || !selectedList || !taskTitles.trim()}
        >
          {isLoading ? 'Inserting...' : 'Insert Tasks'}
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

export default BulkInsert;