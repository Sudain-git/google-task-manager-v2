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
  const [durationMode, setDurationMode] = useState('any');
  const [durationValue, setDurationValue] = useState('');
  const [durationValueEnd, setDurationValueEnd] = useState('');
  const [durationUnit, setDurationUnit] = useState('minutes');

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

  // Bulk operation testing
  const [destinationList, setDestinationList] = useState('');
  const [operationType, setOperationType] = useState('move');
  const [algorithmType, setAlgorithmType] = useState('experimental');
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectedPageSize, setSelectedPageSize] = useState(10);
  const [selectedPage, setSelectedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [opStats, setOpStats] = useState(null);
  const [results, setResults] = useState(null);

  // Date operation controls
  const [startDate, setStartDate] = useState('');
  const [frequency, setFrequency] = useState('interval');
  const [intervalAmount, setIntervalAmount] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState('days');

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
  }, [searchText, searchIn, hasDueDate, durationMode, durationValue, durationValueEnd, durationUnit, dateRangeType, dateRangePreset, dateStart, dateEnd, allTasks]);

  // Auto-apply sort whenever filtered tasks or sort criteria change
  useEffect(() => {
    handleApplySort();
  }, [filteredTasks, sortBy, sortDirection]);

  // Reset filtered page when sorted tasks change
  useEffect(() => {
    setFilteredPage(1);
  }, [sortedTasks]);

  // Reset selected page when selection changes
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
      setSelectedTasks([]);
      setResults(null);

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

    if (durationMode !== 'any' && durationValue !== '') {
      const toSeconds = (val, unit) => {
        const num = parseFloat(val);
        if (isNaN(num)) return null;
        if (unit === 'seconds') return num;
        if (unit === 'minutes') return num * 60;
        if (unit === 'hours') return num * 3600;
        return null;
      };
      const threshold = toSeconds(durationValue, durationUnit);
      const thresholdEnd = durationMode === 'between' ? toSeconds(durationValueEnd, durationUnit) : null;

      if (threshold !== null) {
        filtered = filtered.filter(task => {
          const dur = parseDuration(task.notes);
          if (dur === Infinity) return false;
          if (durationMode === 'less') return dur < threshold;
          if (durationMode === 'greater') return dur > threshold;
          if (durationMode === 'between' && thresholdEnd !== null) {
            const low = Math.min(threshold, thresholdEnd);
            const high = Math.max(threshold, thresholdEnd);
            return dur >= low && dur <= high;
          }
          return true;
        });
      }
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
  }, [allTasks, searchText, searchIn, hasDueDate, durationMode, durationValue, durationValueEnd, durationUnit, dateRangeType, dateRangePreset, dateStart, dateEnd]);

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

  function calculateDueDate(startDateStr, taskIndex, freq, amount, unit) {
    const [year, month, day] = startDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (freq === 'same') {
      return date;
    } else if (freq === 'interval') {
      const totalAmount = amount * taskIndex;

      if (unit === 'days') {
        date.setDate(date.getDate() + totalAmount);
      } else if (unit === 'weekdays') {
        let dayOfWeek = date.getDay();
        while (dayOfWeek === 0 || dayOfWeek === 6) {
          date.setDate(date.getDate() + 1);
          dayOfWeek = date.getDay();
        }
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

  function getOperationLabel() {
    switch (operationType) {
      case 'move': return 'Move';
      case 'dates': return 'Set Dates';
      case 'complete': return 'Complete';
      default: return 'Operation';
    }
  }

  function isRunDisabled() {
    if (isLoading) return true;
    if (selectedTasks.length === 0) return true;
    if (operationType === 'move' && !destinationList) return true;
    if (operationType === 'dates' && !startDate && frequency !== 'clear') return true;
    return false;
  }

  async function handleRunOperation() {
    setIsLoading(true);
    setProgress({ current: 0, total: selectedTasks.length });
    setOpStats(null);
    setResults(null);

    const taskIds = selectedTasks;

    try {
      let result;

      if (operationType === 'move') {
        if (algorithmType === 'experimental') {
          result = await taskAPI.bulkOperation(
            taskIds,
            (id) => taskAPI.moveTask(selectedList, id, null, null, destinationList),
            {
              onProgress: (current, total, stats) => {
                setProgress({ current, total });
                setOpStats(stats);
              },
              stopOnFailure: true
            }
          );
        } else {
          result = await taskAPI.bulkMoveTasks(
            selectedList,
            destinationList,
            taskIds,
            (current, total) => setProgress({ current, total }),
            true
          );
        }
      } else if (operationType === 'dates') {
        if (algorithmType === 'experimental') {
          const items = taskIds.map((taskId, index) => {
            const fullTask = allTasks.find(t => t.id === taskId);
            let updates;
            if (frequency === 'clear') {
              updates = { due: null };
            } else {
              const dueDate = calculateDueDate(startDate, index, frequency, intervalAmount, intervalUnit);
              updates = { due: dueDate.toISOString() };
            }
            return { taskId, resource: { ...fullTask, ...updates } };
          });

          result = await taskAPI.bulkOperation(
            items,
            (item) => window.gapi.client.tasks.tasks.update({
              tasklist: selectedList,
              task: item.taskId,
              resource: item.resource
            }).then(r => r.result),
            {
              onProgress: (current, total, stats) => {
                setProgress({ current, total });
                setOpStats(stats);
              },
              stopOnFailure: true
            }
          );
        } else {
          const updates = taskIds.map((taskId, index) => {
            let taskUpdates;
            if (frequency === 'clear') {
              taskUpdates = { due: null };
            } else {
              const dueDate = calculateDueDate(startDate, index, frequency, intervalAmount, intervalUnit);
              taskUpdates = { due: dueDate.toISOString() };
            }
            return { taskId, updates: taskUpdates };
          });

          result = await taskAPI.bulkUpdateTasks(
            selectedList,
            updates,
            (current, total) => setProgress({ current, total }),
            true
          );
        }
      } else if (operationType === 'complete') {
        if (algorithmType === 'experimental') {
          const items = taskIds.map(taskId => {
            const fullTask = allTasks.find(t => t.id === taskId);
            return { taskId, resource: { ...fullTask, status: 'completed' } };
          });

          result = await taskAPI.bulkOperation(
            items,
            (item) => window.gapi.client.tasks.tasks.update({
              tasklist: selectedList,
              task: item.taskId,
              resource: item.resource
            }).then(r => r.result),
            {
              onProgress: (current, total, stats) => {
                setProgress({ current, total });
                setOpStats(stats);
              },
              stopOnFailure: true
            }
          );
        } else {
          const updates = taskIds.map(taskId => ({
            taskId,
            updates: { status: 'completed' }
          }));

          result = await taskAPI.bulkUpdateTasks(
            selectedList,
            updates,
            (current, total) => setProgress({ current, total }),
            true
          );
        }
      }

      setResults(result);
      console.log('[Dev] Bulk operation complete:', result);

    } catch (error) {
      console.error('[Dev] Bulk operation failed:', error);
      alert('Operation failed: ' + error.message);
    } finally {
      setIsLoading(false);
      setOpStats(null);
    }
  }

  function getZoneColor(zone) {
    switch (zone) {
      case 'red': return 'var(--accent-error, #e53e3e)';
      case 'yellow': return 'var(--accent-warning, #ed8936)';
      case 'green': return 'var(--accent-success, #38a169)';
      default: return 'var(--text-tertiary)';
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
        <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="task-list">Source List</label>
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
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="dest-list">Destination List</label>
            <select
              id="dest-list"
              value={destinationList}
              onChange={(e) => setDestinationList(e.target.value)}
              disabled={isFetching || !selectedList}
            >
              <option value="">Select destination...</option>
              {taskLists.filter(l => l.id !== selectedList).map(list => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
          </div>
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

            {/* Duration Filter */}
            <div className="form-group">
              <label>Duration</label>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                <select
                  value={durationMode}
                  onChange={(e) => {
                    setDurationMode(e.target.value);
                    if (e.target.value === 'any') {
                      setDurationValue('');
                      setDurationValueEnd('');
                    }
                  }}
                  style={{ width: `calc(${{ any: 3, less: 9, greater: 12, between: 7 }[durationMode]}ch + 3.75rem)`, flex: 'none' }}
                >
                  <option value="any">Any</option>
                  <option value="less">Less than</option>
                  <option value="greater">Greater than</option>
                  <option value="between">Between</option>
                </select>
                <input
                  type="number"
                  min="0"
                  value={durationValue}
                  onChange={(e) => setDurationValue(e.target.value)}
                  placeholder="0"
                  disabled={durationMode === 'any'}
                  style={{ width: '70px', flex: 'none' }}
                />
                {durationMode === 'between' && (
                  <>
                    <span style={{ color: 'var(--text-tertiary)', flex: 'none' }}>and</span>
                    <input
                      type="number"
                      min="0"
                      value={durationValueEnd}
                      onChange={(e) => setDurationValueEnd(e.target.value)}
                      placeholder="0"
                      style={{ width: '70px', flex: 'none' }}
                    />
                  </>
                )}
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value)}
                  disabled={durationMode === 'any'}
                  style={{ width: `calc(${{ seconds: 7, minutes: 7, hours: 5 }[durationUnit]}ch + 3.75rem)`, flex: 'none' }}
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                </select>
              </div>
            </div>

            {/* Sort */}
            <div className="form-group" style={{ gridColumnStart: 1 }}>
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

      {/* Two-Panel Task Selection */}
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
                        if (isLoading) return;
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
                        cursor: isLoading ? 'default' : 'pointer',
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
                        {isSelected && '\u2713'}
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
                          disabled={isLoading}
                          style={{
                            padding: 'var(--spacing-xs)',
                            fontSize: '0.75rem',
                            background: 'transparent',
                            border: '1px solid var(--accent-error)',
                            color: 'var(--accent-error)',
                            cursor: isLoading ? 'default' : 'pointer',
                            borderRadius: 'var(--radius-sm)',
                            flexShrink: 0
                          }}
                        >
                          {'\u2715'}
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

      {/* Bulk Operation Controls */}
      {sortedTasks.length > 0 && (
        <div className="form-section">
          <h3>Bulk Operation</h3>
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}>
            {/* Operation Type */}
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="dev-op-type">Operation</label>
              <select
                id="dev-op-type"
                value={operationType}
                onChange={(e) => setOperationType(e.target.value)}
                disabled={isLoading}
              >
                <option value="move">Move Tasks</option>
                <option value="dates">Set Due Dates</option>
                <option value="complete">Complete Tasks</option>
              </select>
            </div>

            {/* Date controls (dates only) */}
            {operationType === 'dates' && (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="dev-start-date">Start Date</label>
                  <input
                    id="dev-start-date"
                    type="date"
                    value={frequency === 'clear' ? '' : startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isLoading || frequency === 'clear'}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="dev-frequency">Frequency</label>
                  <select
                    id="dev-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="same">Same date for all</option>
                    <option value="interval">Interval</option>
                    <option value="clear">Clear due date</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="dev-interval-amount">Every</label>
                  <input
                    id="dev-interval-amount"
                    type="number"
                    min="0"
                    value={frequency === 'same' || frequency === 'clear' ? 0 : intervalAmount}
                    onChange={(e) => setIntervalAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={isLoading || frequency === 'same' || frequency === 'clear'}
                    style={{ width: '60px' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="dev-interval-unit">Unit</label>
                  <select
                    id="dev-interval-unit"
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
              </>
            )}

            {/* Algorithm Selector */}
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="dev-algorithm">Algorithm</label>
              <select
                id="dev-algorithm"
                value={algorithmType}
                onChange={(e) => setAlgorithmType(e.target.value)}
                disabled={isLoading}
              >
                <option value="experimental">Experimental (adaptive zones)</option>
                <option value="legacy">Legacy (per-operation)</option>
              </select>
            </div>

            {/* Run Button */}
            <button
              className="primary"
              onClick={handleRunOperation}
              disabled={isRunDisabled()}
              style={{ alignSelf: 'flex-end' }}
            >
              Run {getOperationLabel()} on {selectedTasks.length} task(s)
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar + Live Stats */}
      {isLoading && (
        <div className="form-section">
          <div className="progress-container">
            <div className="progress-header">
              <span className="progress-label">{getOperationLabel()}...</span>
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

          {/* Live stats (experimental only) */}
          {opStats && (
            <div style={{
              marginTop: 'var(--spacing-md)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              display: 'flex',
              gap: 'var(--spacing-lg)',
              alignItems: 'center',
              flexWrap: 'wrap',
              fontFamily: 'monospace'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: getZoneColor(opStats.zone),
                  display: 'inline-block'
                }} />
                Zone: {opStats.zone}
              </span>
              <span>Delay: {opStats.currentDelay}ms</span>
              <span>Floor: {opStats.currentFloor}ms</span>
              <span>Avg: {opStats.currentAverage}ms</span>
              <span>Peak: {opStats.currentPeak}ms</span>
              <span>Sustainable: {opStats.sustainableDelay}ms</span>
              <span>Rate limits: {opStats.rateLimitHits} outstanding, {opStats.recentRateLimitHits} in last 5m</span>
            </div>
          )}
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
                <summary>View Failed Operations</summary>
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
