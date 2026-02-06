import { useState, useEffect } from 'react';
import { taskAPI } from '../../utils/taskApi';
import { extractPlaylistId, getPlaylistVideos } from '../../utils/youtubeApi';

function YouTubeImport() {
  // Core state
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [loadingLists, setLoadingLists] = useState(true);

  // Input
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistError, setPlaylistError] = useState('');

  // Fetched videos (before import)
  const [videos, setVideos] = useState([]);
  const [isFetchingPlaylist, setIsFetchingPlaylist] = useState(false);

  // Pagination for preview
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);

  // Import processing
  const [isImporting, setIsImporting] = useState(false);
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

  async function handleFetchPlaylist() {
    setPlaylistError('');
    setVideos([]);
    setResults(null);

    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) {
      setPlaylistError('Invalid playlist URL. Please enter a valid YouTube playlist link.');
      return;
    }

    try {
      setIsFetchingPlaylist(true);
      const videoUrls = await getPlaylistVideos(playlistId);
      setVideos(videoUrls);
      setPreviewPage(1);
    } catch (error) {
      setPlaylistError(error.message);
    } finally {
      setIsFetchingPlaylist(false);
    }
  }

  async function handleImport() {
    if (!selectedList || videos.length === 0) return;

    try {
      setIsImporting(true);
      setResults(null);
      setProgress({ current: 0, total: videos.length });

      // Convert video URLs to task objects
      const tasks = videos.map(url => ({ title: url }));

      const result = await taskAPI.bulkInsertTasks(
        selectedList,
        tasks,
        (current, total) => setProgress({ current, total })
      );

      setResults(result);
    } catch (error) {
      alert('Import failed: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  }

  function handleClear() {
    setPlaylistUrl('');
    setPlaylistError('');
    setVideos([]);
    setResults(null);
    setProgress({ current: 0, total: 0 });
  }

  // Pagination helpers
  const totalPages = Math.ceil(videos.length / previewPageSize);
  const paginatedVideos = videos.slice(
    (previewPage - 1) * previewPageSize,
    previewPage * previewPageSize
  );

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
        <h2>Import YouTube Playlist</h2>
        <p>
          Fetch videos from a YouTube playlist and create a task for each video.
          Video URLs will be used as task titles.
        </p>
      </div>

      {/* Destination List Selection */}
      <div className="form-section">
        <h3>Destination List</h3>
        <div className="form-group">
          <label htmlFor="task-list">Task List</label>
          <select
            id="task-list"
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
            disabled={isImporting}
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

      {/* Playlist URL Input */}
      <div className="form-section">
        <h3>YouTube Playlist</h3>
        <div className="form-group">
          <label htmlFor="playlist-url">Playlist URL</label>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <input
              type="text"
              id="playlist-url"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              placeholder="https://www.youtube.com/playlist?list=PLxxxxx"
              disabled={isFetchingPlaylist || isImporting}
              style={{ flex: 1 }}
            />
            <button
              onClick={handleFetchPlaylist}
              disabled={!playlistUrl.trim() || isFetchingPlaylist || isImporting}
            >
              {isFetchingPlaylist ? 'Fetching...' : 'Fetch Videos'}
            </button>
          </div>
          {playlistError && (
            <p style={{ color: 'var(--error)', marginTop: 'var(--spacing-sm)', marginBottom: 0 }}>
              {playlistError}
            </p>
          )}
        </div>
      </div>

      {/* Video Preview */}
      {videos.length > 0 && (
        <div className="form-section">
          <h3>Videos Found: {videos.length}</h3>

          {/* Page Size Selector */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-md)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <label htmlFor="page-size" style={{ fontSize: '0.875rem' }}>Show:</label>
              <select
                id="page-size"
                value={previewPageSize}
                onChange={(e) => {
                  setPreviewPageSize(Number(e.target.value));
                  setPreviewPage(1);
                }}
                style={{ width: 'auto', minWidth: '80px' }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <button
                  onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                  disabled={previewPage === 1}
                  style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
                >
                  Prev
                </button>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Page {previewPage} of {totalPages}
                </span>
                <button
                  onClick={() => setPreviewPage(p => Math.min(totalPages, p + 1))}
                  disabled={previewPage === totalPages}
                  style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Video List */}
          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {paginatedVideos.map((url, index) => (
              <div
                key={index}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderBottom: index < paginatedVideos.length - 1 ? '1px solid var(--border-color)' : 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.875rem',
                  wordBreak: 'break-all'
                }}
              >
                <span style={{ color: 'var(--text-tertiary)', marginRight: 'var(--spacing-sm)' }}>
                  {(previewPage - 1) * previewPageSize + index + 1}.
                </span>
                {url}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty Playlist Message */}
      {videos.length === 0 && !isFetchingPlaylist && !playlistError && playlistUrl && (
        <div className="form-section">
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            No videos found in this playlist.
          </p>
        </div>
      )}

      {/* Progress Indicator */}
      {isImporting && (
        <div className="progress-container">
          <div className="progress-header">
            <span className="progress-label">Importing Videos...</span>
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
              <summary>View Failed Imports</summary>
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
          onClick={handleImport}
          disabled={isImporting || !selectedList || videos.length === 0}
        >
          {isImporting ? 'Importing...' : `Import ${videos.length} Video${videos.length !== 1 ? 's' : ''} as Tasks`}
        </button>
        <button
          onClick={handleClear}
          disabled={isImporting}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default YouTubeImport;
