import { useState, useEffect } from 'react';
import { taskAPI } from '../../utils/taskApi';
import FetchingIndicator from '../FetchingIndicator';
// No need to import youtubeApi here - we'll do dynamic import in the function

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

  // Prioritized channels list
  const PRIORITIZED_CHANNELS = [
    'Philip DeFranco',
    'Mystic Arts',
    'The Late Show with Stephen Colbert',
    'Wes Roth',
    'Timothy Cain',
    'Gamers Nexus',
    'Fantasy Grounds Academy',
    'AdviceWithErin',
    'LastWeekTonight',
    'The Diary Of A CEO',
    'LegalEagle',
    'Ticker Symbol: YOU',
    'Hak5',
    'vlogbrothers',
    'Zee Bashew',
    'Lindsey Stirling',
    'Hank Green',
    'PoliticsGirl',
    'Vinh Giang',
    'Shannon Morse',
    'In Good Faith with Philip DeFranco',
    'Veritasium',
    'Alton Brown',
    'NOAPOLOGY',
    'Charisma on Command',
    'MALINDA',
    'Alina Gingertail',
    'City of Fort Collins',
    'Harp Twins',
    'Elle Cordova',
    'The Onion',
    'Alex Hormozi',
    'James Butler',
    'Lauren Jumps',
    'Brooke Monk',
    'Orion Taraban',
    'Simon Sinek',
    'Taylor Davis',
    'Esther Perel',
    'Robert Miles AI Safety',
    'First We Feast',
    'Captain Disillusion',
    'Ryan George',
    'Matthew Hussey',
    'Map Crow',
    'MALINDA - Shorts',
    'Madelyn Monaghan',
    'Neuralink',
    'MonarchsFactory',
    'Twisted Translations',
    'Matthew Colville',
    'LindseyTime',
    'Healthcare Triage',
    'CrashCourse',
    'tangostudent',
    'OverClocked ReMix: Video Game Music Community',
    'MythKeeper',
    'Game Maker\'s Toolkit'
  ];

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

        // Check if channel is in prioritized list (case-insensitive)
        const isPrioritized = PRIORITIZED_CHANNELS.some(
          prioritizedChannel => 
            metadata.channelTitle.toLowerCase().includes(prioritizedChannel.toLowerCase()) ||
            prioritizedChannel.toLowerCase().includes(metadata.channelTitle.toLowerCase())
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
            📺 YouTube Tasks Found
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

          {/* Prioritized Channels Info - Collapsible */}
          <details style={{
            marginTop: 'var(--spacing-md)',
            paddingTop: 'var(--spacing-md)',
            borderTop: '1px solid var(--border-color)'
          }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--spacing-sm)',
              userSelect: 'none',
              padding: 'var(--spacing-sm)',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)',
              transition: 'background var(--transition-base)',
              listStyle: 'none'
            }}>
              ▸ Prioritized Channels ({PRIORITIZED_CHANNELS.length} channels will include channel name)
            </summary>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 'var(--spacing-xs)',
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              marginTop: 'var(--spacing-md)',
              paddingLeft: 'var(--spacing-md)'
            }}>
              {PRIORITIZED_CHANNELS.map(channel => (
                <div key={channel}>• {channel}</div>
              ))}
            </div>
          </details>
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