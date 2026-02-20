import { useState, useEffect } from 'react';
import { taskAPI } from '../../utils/taskApi';
import { googleAuth } from '../../auth/GoogleAuth';
import FetchingIndicator from '../FetchingIndicator';

function AutoSetNotes() {
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const [youtubeChannels, setYoutubeChannels] = useState([]);
  const [eligibleTasks, setEligibleTasks] = useState([]);
  const [allScannedTasks, setAllScannedTasks] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState(null);

  // Channel management state
  const [channelText, setChannelText] = useState('');
  const [isFetchingSubs, setIsFetchingSubs] = useState(false);
  const [subsFetchError, setSubsFetchError] = useState('');

  // Derive channel list from textarea
  const channelList = channelText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

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

  async function handleScanTasks(listId) {
    if (!listId) {
      return;
    }

    try {
      setIsFetching(true);
      setEligibleTasks([]);
      setYoutubeChannels([]);
      setResults(null);

      console.log('[AutoSetNotes] Fetching all tasks from list...');
      const allTasks = await taskAPI.getAllTasksFromList(listId, false, false);
      setAllScannedTasks(allTasks);

      console.log('[AutoSetNotes] Scanning for YouTube URLs...');

      // Filter for tasks with YouTube URLs (videos and shorts) and empty notes
      const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      const eligible = allTasks.filter(task => {
        const hasYoutubeUrl = youtubeRegex.test(task.title);
        const hasEmptyNotes = !task.notes || task.notes.trim() === '';
        return hasYoutubeUrl && hasEmptyNotes;
      });

      setEligibleTasks(eligible);

      console.log(`[AutoSetNotes] Found ${eligible.length} eligible YouTube tasks`);

    } catch (error) {
      console.error('Failed to scan tasks:', error);
      alert('Failed to scan tasks: ' + error.message);
    } finally {
      setIsFetching(false);
    }
  }

  async function handleFetchSubscriptions() {
    try {
      setIsFetchingSubs(true);
      setSubsFetchError('');

      // Request YouTube scope via incremental auth
      const accessToken = await googleAuth.requestYouTubeScope();

      // Fetch subscriptions
      const { getUserSubscriptions } = await import('../../utils/youtubeApi');
      const channels = await getUserSubscriptions(accessToken);

      if (channels.length === 0) {
        setSubsFetchError('No subscriptions found. This can happen with brand accounts or accounts with no subscriptions.');
      } else {
        setChannelText(channels.join('\n'));
        setSubsFetchError('');
      }
    } catch (error) {
      console.error('[AutoSetNotes] Failed to fetch subscriptions:', error);
      setSubsFetchError(error.message);
    } finally {
      setIsFetchingSubs(false);
    }
  }

  function handleSaveChannels() {
    localStorage.setItem('gtm-channel-list', channelText);
    setSubsFetchError('Channel list saved.');
  }

  function handleLoadChannels() {
    const saved = localStorage.getItem('gtm-channel-list');
    if (saved !== null) {
      setChannelText(saved);
      setSubsFetchError('Channel list loaded.');
    } else {
      setSubsFetchError('No saved channel list found.');
    }
  }

  function handleDeleteChannels() {
    localStorage.removeItem('gtm-channel-list');
    setSubsFetchError('Saved channel list deleted.');
  }

async function handleProcessTasks() {
    if (eligibleTasks.length === 0) {
      alert('No tasks to process');
      return;
    }

    try {
      setIsLoading(true);
      setProgress({ current: 0, total: eligibleTasks.length });
      setResults(null);

      console.log('[AutoSetNotes] Starting to process YouTube tasks...');

      // Import YouTube utilities
      const { extractVideoId, getBatchVideoMetadata } = await import('../../utils/youtubeApi');

      // Extract video IDs from all tasks
      const taskVideoMap = eligibleTasks.map(task => ({
        task,
        videoId: extractVideoId(task.title)
      })).filter(item => item.videoId !== null);

      console.log(`[AutoSetNotes] Extracted ${taskVideoMap.length} video IDs`);

      // Fetch metadata for all videos in batches
      const videoIds = taskVideoMap.map(item => item.videoId);
      console.log('[AutoSetNotes] Fetching YouTube metadata...');
      const videoMetadata = await getBatchVideoMetadata(videoIds);

      // Create a map of videoId -> metadata
      const metadataMap = new Map();
      videoMetadata.forEach(meta => {
        metadataMap.set(meta.videoId, meta);
      });

      console.log(`[AutoSetNotes] Retrieved metadata for ${videoMetadata.length} videos`);

      // Prepare updates with formatted notes
      const updates = [];
      const notFound = [];

      taskVideoMap.forEach(({ task, videoId }) => {
        const metadata = metadataMap.get(videoId);

        if (!metadata) {
          notFound.push({ task, reason: 'Video metadata not found' });
          return;
        }

        // Check if channel is in user's channel list (case-insensitive)
        const isPrioritized = channelList.length > 0 && channelList.some(
          ch =>
            metadata.channelTitle.toLowerCase().includes(ch.toLowerCase()) ||
            ch.toLowerCase().includes(metadata.channelTitle.toLowerCase())
        );

        // Format note string
        let noteString;
        if (isPrioritized) {
          // Format: [duration] - [channel] - [video title]
          noteString = `${metadata.duration} - ${metadata.channelTitle} - ${metadata.title}`;
        } else {
          // Format: [duration] - [video title]
          noteString = `${metadata.duration} - ${metadata.title}`;
        }

        updates.push({
          taskId: task.id,
          taskTitle: task.title,
          updates: { notes: noteString }
        });
      });

      console.log(`[AutoSetNotes] Prepared ${updates.length} updates, ${notFound.length} not found`);

      // Perform bulk update with rate limiting
      const result = await taskAPI.bulkUpdateTasks(
        selectedList,
        updates,
        (current, total) => setProgress({ current, total }),
        true, // stopOnFailure
        allScannedTasks // pass pre-fetched tasks to avoid redundant fetch
      );

      // Add not found to results
      result.notFound = notFound;

      // Show results
      setResults(result);

      // Clear eligible tasks on success
      if (result.failed.length === 0 && notFound.length === 0) {
        setEligibleTasks([]);
      }

    } catch (error) {
      console.error('Failed to process YouTube tasks:', error);
      alert('Failed to process tasks: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setEligibleTasks([]);
    setAllScannedTasks([]);
    setYoutubeChannels([]);
    setResults(null);
    setProgress({ current: 0, total: 0 });
    // channelText intentionally NOT cleared
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
        <h2>Automatic Set Notes (YouTube)</h2>
        <p>
          Automatically set notes on tasks containing YouTube URLs with video metadata
          (duration, channel, title).
        </p>
      </div>

      <div className="form-section">
        <h3>Select Task List</h3>
        <div className="form-group">
          <label htmlFor="task-list">Task List</label>
          <select
            id="task-list"
            value={selectedList}
            onChange={(e) => {
              setSelectedList(e.target.value);
              handleScanTasks(e.target.value);
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

      {/* Channel Management Section */}
      <div className="form-section">
        <h3>Channel List</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 var(--spacing-md) 0' }}>
          Matching channels get <code>[duration] - [channel] - [title]</code> format.
          Non-matching channels get <code>[duration] - [title]</code>.
          Leave empty to skip channel matching entirely.
        </p>

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
          <button
            onClick={handleFetchSubscriptions}
            disabled={isFetchingSubs || isLoading}
            className="primary"
            style={{ fontSize: '0.8rem' }}
          >
            {isFetchingSubs ? 'Fetching...' : 'Fetch My YouTube Subscriptions'}
          </button>
          <button
            onClick={handleSaveChannels}
            disabled={isLoading}
            style={{ fontSize: '0.8rem' }}
          >
            Save List
          </button>
          <button
            onClick={handleLoadChannels}
            disabled={isLoading}
            style={{ fontSize: '0.8rem' }}
          >
            Load Saved
          </button>
          <button
            onClick={handleDeleteChannels}
            disabled={isLoading}
            style={{ fontSize: '0.8rem' }}
          >
            Delete Saved
          </button>
        </div>

        {subsFetchError && (
          <p style={{
            fontSize: '0.8rem',
            color: subsFetchError.includes('saved') || subsFetchError.includes('loaded') || subsFetchError.includes('deleted')
              ? 'var(--accent-success, #4caf50)'
              : 'var(--accent-warning, #ff9800)',
            margin: '0 0 var(--spacing-md) 0'
          }}>
            {subsFetchError}
          </p>
        )}

        <textarea
          value={channelText}
          onChange={(e) => setChannelText(e.target.value)}
          placeholder="One channel name per line&#10;e.g.&#10;Veritasium&#10;Hank Green&#10;Gamers Nexus"
          rows={8}
          style={{
            width: '100%',
            fontFamily: 'inherit',
            fontSize: '0.8rem',
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 'var(--spacing-xs) 0 0 0' }}>
          {channelList.length} channel{channelList.length !== 1 ? 's' : ''} configured
        </p>
      </div>

      {/* Fetching Indicator */}
      {isFetching && (
        <FetchingIndicator
          message="Scanning Tasks for YouTube URLs..."
          subMessage="Identifying tasks with YouTube videos and empty notes"
        />
      )}

      {/* Eligible Tasks Info Card */}
      {!isFetching && eligibleTasks.length > 0 && (
        <div style={{
          padding: 'var(--spacing-lg)',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <h3 style={{
            fontSize: '0.875rem',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--text-secondary)'
          }}>
            YouTube Tasks Found
          </h3>
          <p style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--accent-primary)',
            margin: '0 0 var(--spacing-sm) 0'
          }}>
            {eligibleTasks.length} task{eligibleTasks.length !== 1 ? 's' : ''}
          </p>
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            margin: 0
          }}>
            Tasks with YouTube URLs and empty notes ready for processing
          </p>
        </div>
      )}

      {/* No Tasks Found */}
      {!isFetching && eligibleTasks.length === 0 && selectedList && (
        <div style={{
          padding: 'var(--spacing-lg)',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          No YouTube tasks found with empty notes in this list.
        </div>
      )}

      {/* Progress Indicator */}
      {isLoading && (
        <div className="progress-container">
          <div className="progress-header">
            <span className="progress-label">Processing YouTube Tasks...</span>
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
                    {item.taskId}: {item.error}
                  </div>
                ))}
              </div>
            </details>
          )}

          {results.notFound && results.notFound.length > 0 && (
            <details className="results-details">
              <summary>View Videos Not Found</summary>
              <div className="results-list">
                {results.notFound.map((item, index) => (
                  <div key={index} className="result-item" style={{ borderLeftColor: 'var(--accent-warning)', color: 'var(--accent-warning)' }}>
                    {item.task.title}: {item.reason}
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
          onClick={handleProcessTasks}
          disabled={eligibleTasks.length === 0 || isLoading}
        >
          {isLoading ? 'Processing...' : `Process ${eligibleTasks.length} Task${eligibleTasks.length !== 1 ? 's' : ''}`}
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

export default AutoSetNotes;
