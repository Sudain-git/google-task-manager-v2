import { useState, useEffect, useCallback } from 'react';
import { taskAPI } from '../../utils/taskApi';
import FetchingIndicator from '../FetchingIndicator';

function ParentChild() {
  // Core state
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [loadingLists, setLoadingLists] = useState(true);

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [searchIn, setSearchIn] = useState('title');
  const [hasDueDate, setHasDueDate] = useState('either');
  const [hasParentFilter, setHasParentFilter] = useState('either');
  const [hasNotes, setHasNotes] = useState('either');
  const [dateRangeType, setDateRangeType] = useState('created'); // 'created', 'due'
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

  // Pagination
  const [filteredPageSize, setFilteredPageSize] = useState(10);
  const [filteredPage, setFilteredPage] = useState(1);
  const [selectedPageSize, setSelectedPageSize] = useState(10);
  const [selectedPage, setSelectedPage] = useState(1);

  // Selection
  const [selectedTasks, setSelectedTasks] = useState([]);

  // Parent-Child specific
  const [operationMode, setOperationMode] = useState('manageParent'); // 'manageParent' | 'reorderChildren'
  const [designatedParentId, setDesignatedParentId] = useState(null); // The designated parent task
  const [reorderParentId, setReorderParentId] = useState(null); // The parent whose children we're reordering
  const [childrenOrder, setChildrenOrder] = useState([]); // Array of child task IDs in current order

  // Processing
  const [isLoading, setIsLoading] = useState(false);

  // Warning animation for nesting rule violation
  const [showNestingWarning, setShowNestingWarning] = useState(false);

  // Track which abandon button is being hovered (by task ID)
  const [hoveredAbandonId, setHoveredAbandonId] = useState(null);

  // Load task lists on mount
  useEffect(() => {
    loadTaskLists();
  }, []);

  // Auto-apply filters whenever filter criteria or allTasks change
  useEffect(() => {
    if (allTasks.length > 0) {
      handleApplyFilters();
    }
  }, [searchText, searchIn, hasDueDate, hasParentFilter, hasNotes, dateRangeType, dateStart, dateEnd, allTasks]);

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

  // Load children when switching to reorder mode with a single parent selected
  useEffect(() => {
    if (operationMode === 'reorderChildren' && selectedTasks.length === 1) {
      const taskId = selectedTasks[0];
      if (hasChildren(taskId)) {
        loadChildrenForParent(taskId);
      } else {
        setReorderParentId(null);
        setChildrenOrder([]);
      }
    } else if (operationMode === 'reorderChildren') {
      setReorderParentId(null);
      setChildrenOrder([]);
    }
  }, [operationMode, selectedTasks, allTasks]);

  // Clear designated parent when mode changes
  useEffect(() => {
    if (operationMode !== 'manageParent') {
      setDesignatedParentId(null);
    }
  }, [operationMode]);

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

  async function handleFetchTasks(listId, preserveSelection = false) {
    if (!listId) {
      alert('Please select a task list');
      return;
    }

    try {
      setIsFetching(true);
      setAllTasks([]);
      setFilteredTasks([]);
      setSortedTasks([]);
      if (!preserveSelection) {
        setSelectedTasks([]);
        setDesignatedParentId(null);
      }
      setReorderParentId(null);
      setChildrenOrder([]);

      console.log('[ParentChild] Fetching all tasks from list...');
      const tasks = await taskAPI.getAllTasksFromList(listId, false, false);

      // Filter out completed tasks automatically
      const activeTasks = tasks.filter(task => task.status !== 'completed');

      setAllTasks(activeTasks);

      // If preserving selection, filter out any selected tasks that no longer exist
      if (preserveSelection) {
        const activeTaskIds = new Set(activeTasks.map(t => t.id));
        setSelectedTasks(prev => prev.filter(id => activeTaskIds.has(id)));
      }

      console.log(`[ParentChild] Fetched ${activeTasks.length} active tasks`);

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
    console.log('[ParentChild] Applying filters...');

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
    if (hasParentFilter !== 'either') {
      filtered = filtered.filter(task => {
        const hasParentTask = !!task.parent;
        return hasParentFilter === 'yes' ? hasParentTask : !hasParentTask;
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
    console.log(`[ParentChild] Filtered to ${filtered.length} tasks from ${allTasks.length} total`);
  }, [allTasks, searchText, searchIn, hasDueDate, hasParentFilter, hasNotes, dateRangeType, dateStart, dateEnd]);

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

    console.log('[ParentChild] Applying sort...');

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
    console.log(`[ParentChild] Sorted ${sorted.length} tasks by ${sortBy} (${sortDirection})`);
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

  // Helper functions
  function getTaskById(taskId) {
    return allTasks.find(t => t.id === taskId);
  }

  function getParentTitle(task) {
    if (!task?.parent) return null;
    const parent = allTasks.find(t => t.id === task.parent);
    return parent?.title || 'Unknown Parent';
  }

  function getSelectedTasksData() {
    return selectedTasks.map(id => getTaskById(id)).filter(Boolean);
  }

  function getChildrenOfTask(parentId) {
    return allTasks.filter(t => t.parent === parentId);
  }

  function hasChildren(taskId) {
    return allTasks.some(t => t.parent === taskId);
  }

  function hasParent(taskId) {
    const task = getTaskById(taskId);
    return !!task?.parent;
  }

  /**
   * Check if a task can be set as parent
   * - Cannot be a parent if it already has a parent (no multi-level nesting)
   */
  function canBeParent(taskId) {
    const task = getTaskById(taskId);
    return task && !task.parent;
  }

  /**
   * Check if a task can become a child
   * - Cannot become a child if it already has children (no multi-level nesting)
   */
  function canBeChild(taskId) {
    return !hasChildren(taskId);
  }

  function loadChildrenForParent(parentId) {
    const children = getChildrenOfTask(parentId);
    // Tasks are returned in order from API, so preserve that order
    setChildrenOrder(children.map(c => c.id));
    setReorderParentId(parentId);
  }

  /**
   * Remove a single task's parent relationship
   */
  async function handleRemoveSingleParentRelationship(taskId) {
    try {
      setIsLoading(true);

      await taskAPI.moveTask(selectedList, taskId, null);

      // Clear designated parent to refresh status display
      setDesignatedParentId(null);

      // Refresh task list
      await handleFetchTasks(selectedList, true);

    } catch (error) {
      console.error('Failed to remove parent relationship:', error);
      alert('Failed to remove parent relationship: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Abandon all children of a parent task (remove all their parent relationships)
   */
  async function handleAbandonAllChildren(parentId) {
    const children = getChildrenOfTask(parentId);
    if (children.length === 0) return;

    try {
      setIsLoading(true);

      for (let i = 0; i < children.length; i++) {
        await taskAPI.moveTask(selectedList, children[i].id, null);

        // Rate limit: 200ms delay between calls
        if (i < children.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Clear hover state and refresh
      setHoveredAbandonId(null);
      setDesignatedParentId(null);
      await handleFetchTasks(selectedList, true);

    } catch (error) {
      console.error('Failed to abandon children:', error);
      alert('Failed to abandon children: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Handle clicking on a task to set/unset it as parent (immediate action)
   */
  async function handleParentClick(taskId) {
    if (isLoading) return;

    const task = getTaskById(taskId);
    if (!task) return;

    // If clicking on current parent, do nothing (parent is already set)
    if (designatedParentId === taskId) {
      return;
    }

    // If clicking on a task that already has a parent, remove its parent relationship
    if (task.parent) {
      await handleRemoveSingleParentRelationship(taskId);
      return;
    }

    // Get tasks that will become children (excluding the new parent)
    const childTaskIds = selectedTasks.filter(id => id !== taskId);

    // Check if any would-be children already have children
    const tasksWithChildren = childTaskIds.filter(id => hasChildren(id));
    if (tasksWithChildren.length > 0) {
      // Trigger warning animation instead of alert
      setShowNestingWarning(true);
      setTimeout(() => setShowNestingWarning(false), 1000);
      return;
    }

    if (childTaskIds.length === 0) {
      setDesignatedParentId(taskId);
      return;
    }

    // Set the parent immediately
    try {
      setIsLoading(true);
      setDesignatedParentId(taskId);

      for (let i = 0; i < childTaskIds.length; i++) {
        const childId = childTaskIds[i];
        await taskAPI.moveTask(selectedList, childId, taskId);

        // Rate limit: 200ms delay between calls
        if (i < childTaskIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Clear designated parent to refresh status display from API data
      setDesignatedParentId(null);

      // Refresh task list to show updated hierarchy
      await handleFetchTasks(selectedList, true);

    } catch (error) {
      console.error('Failed to set parent:', error);
      alert('Failed to set parent: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }


  /**
   * Move a child task up in the order
   */
  async function handleMoveChildUp(childId) {
    const currentIndex = childrenOrder.indexOf(childId);
    if (currentIndex <= 0) return; // Already first

    try {
      setIsLoading(true);

      // Move to position after previous-previous (or null for first)
      const previousId = currentIndex === 1 ? null : childrenOrder[currentIndex - 2];
      await taskAPI.moveTask(selectedList, childId, reorderParentId, previousId);

      // Update local order
      const newOrder = [...childrenOrder];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      setChildrenOrder(newOrder);

    } catch (error) {
      console.error('Failed to move child up:', error);
      alert('Failed to reorder: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Move a child task down in the order
   */
  async function handleMoveChildDown(childId) {
    const currentIndex = childrenOrder.indexOf(childId);
    if (currentIndex >= childrenOrder.length - 1) return; // Already last

    try {
      setIsLoading(true);

      // Move after next sibling
      const previousId = childrenOrder[currentIndex + 1];
      await taskAPI.moveTask(selectedList, childId, reorderParentId, previousId);

      // Update local order
      const newOrder = [...childrenOrder];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      setChildrenOrder(newOrder);

    } catch (error) {
      console.error('Failed to move child down:', error);
      alert('Failed to reorder: ' + error.message);
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

  // Get selected tasks data (de-coupled from filtering)
  const selectedTasksData = getSelectedTasksData();

  return (
    <div>
      <div className="tab-header">
        <h2>Manage Parent/Child Relationships</h2>
        <p>
          Organize tasks into parent-child hierarchies. Select tasks, then click one to make it the parent. Click the parent again to remove relationships.
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
            <option value="">Select a task list...</option>
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
                value={hasParentFilter}
                onChange={(e) => setHasParentFilter(e.target.value)}
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
                    onClick={() => {
                      setSelectedTasks([]);
                      setDesignatedParentId(null);
                    }}
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
                  const parentTitle = getParentTitle(task);
                  const taskHasChildren = hasChildren(task.id);

                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTasks(prev => prev.filter(id => id !== task.id));
                          if (designatedParentId === task.id) {
                            setDesignatedParentId(null);
                          }
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
                            <span>Due: {new Date(task.due).toLocaleDateString()}</span>
                          )}
                          {task.notes && parseDuration(task.notes) !== Infinity && (
                            <span>{formatDurationPreview(parseDuration(task.notes))}</span>
                          )}
                          {parentTitle && (
                            <span style={{ color: 'var(--accent-warning, #ed8936)' }}>
                              Parent: {parentTitle}
                            </span>
                          )}
                          {taskHasChildren && (
                            <span style={{ color: 'var(--accent-primary)' }}>
                              Has children
                            </span>
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

            {/* Right: Selected Tasks with Relationship Management */}
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
                      onClick={() => {
                        setSelectedTasks([]);
                        setDesignatedParentId(null);
                      }}
                      disabled={isLoading}
                      style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.75rem' }}
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              {/* Mode Toggle Buttons */}
              <div style={{
                display: 'flex',
                gap: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-md)'
              }}>
                <button
                  onClick={() => setOperationMode('manageParent')}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    background: operationMode === 'manageParent' ? 'var(--accent-primary)' : 'transparent',
                    color: operationMode === 'manageParent' ? 'white' : 'var(--text-primary)',
                    border: `2px solid ${operationMode === 'manageParent' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer'
                  }}
                >
                  Set/Remove Parent
                </button>
                <button
                  onClick={() => setOperationMode('reorderChildren')}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    background: operationMode === 'reorderChildren' ? 'var(--accent-primary)' : 'transparent',
                    color: operationMode === 'reorderChildren' ? 'white' : 'var(--text-primary)',
                    border: `2px solid ${operationMode === 'reorderChildren' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer'
                  }}
                >
                  Reorder Children
                </button>
              </div>

              {/* Manage Parent Mode (combined Set/Remove) */}
              {operationMode === 'manageParent' && (
                <>
                  {selectedTasks.length < 2 ? (
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
                      Select at least 2 tasks to set parent-child relationships.
                    </div>
                  ) : (
                    <div style={{
                      padding: 'var(--spacing-md)',
                      background: 'rgba(49, 130, 206, 0.05)',
                      border: '2px solid var(--accent-primary)',
                      borderRadius: 'var(--radius-md)',
                      maxHeight: '500px',
                      overflowY: 'auto'
                    }}>
                      <p style={{
                        margin: '0 0 var(--spacing-md) 0',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Click a task to make it a <span style={{ color: 'var(--accent-success, #48bb78)', fontWeight: '600' }}>parent</span> of selected orphaned tasks. Click a <span style={{ color: 'var(--accent-warning, #ed8936)', fontWeight: '600' }}>child</span> task to remove the parent/child relationship.
                      </p>

                      {/* De-coupled from sorting: show selected tasks in selection order */}
                      {selectedTasksData
                        .slice((selectedPage - 1) * selectedPageSize, selectedPage * selectedPageSize)
                        .map((task, index) => {
                          const taskHasChildren = hasChildren(task.id);
                          const isChild = !!task.parent;
                          const isActualParent = taskHasChildren;
                          const parentTitle = getParentTitle(task);

                          // Determine background and border colors based on actual relationships
                          let bgColor = 'var(--bg-primary)';
                          let borderColor = '1px solid var(--border-color)';
                          let radioColor = 'var(--border-color)';

                          if (isActualParent) {
                            bgColor = 'rgba(72, 187, 120, 0.15)';
                            borderColor = '2px solid var(--accent-success)';
                            radioColor = 'var(--accent-success)';
                          } else if (isChild) {
                            bgColor = 'rgba(237, 137, 54, 0.15)';
                            borderColor = '2px solid var(--accent-warning, #ed8936)';
                            radioColor = 'var(--accent-warning, #ed8936)';
                          }

                          return (
                            <div
                              key={task.id}
                              onClick={() => handleParentClick(task.id)}
                              style={{
                                padding: 'var(--spacing-sm)',
                                marginBottom: 'var(--spacing-xs)',
                                background: bgColor,
                                border: borderColor,
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.875rem',
                                cursor: isLoading ? 'wait' : 'pointer',
                                display: 'flex',
                                gap: 'var(--spacing-md)',
                                alignItems: 'center',
                                opacity: isLoading ? 0.7 : 1
                              }}
                            >
                              <div style={{
                                minWidth: '20px',
                                height: '20px',
                                border: `2px solid ${radioColor}`,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                background: (isActualParent || isChild) ? radioColor : 'transparent'
                              }}>
                                {(isActualParent || isChild) && (
                                  <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: 'white'
                                  }} />
                                )}
                              </div>

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
                                {isChild && parentTitle && (
                                  <div style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--accent-warning, #ed8936)',
                                    marginTop: '2px'
                                  }}>
                                    Child of: {parentTitle}
                                  </div>
                                )}
                              </div>

                              {isActualParent && (
                                <>
                                  <span
                                    onMouseEnter={() => setHoveredAbandonId(task.id)}
                                    onMouseLeave={() => setHoveredAbandonId(null)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (hoveredAbandonId === task.id && !isLoading) {
                                        handleAbandonAllChildren(task.id);
                                      }
                                    }}
                                    style={{
                                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                                      background: 'var(--accent-error, #e53e3e)',
                                      color: 'white',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '0.625rem',
                                      fontWeight: '700',
                                      flexShrink: 0,
                                      cursor: hoveredAbandonId === task.id ? 'pointer' : 'default',
                                      transition: 'all 0.2s ease',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden'
                                    }}
                                  >
                                    {hoveredAbandonId === task.id ? 'Abandon Children' : 'Abandon'}
                                  </span>
                                  <span style={{
                                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                                    background: 'var(--accent-success)',
                                    color: 'white',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.625rem',
                                    fontWeight: '700',
                                    flexShrink: 0
                                  }}>
                                    PARENT
                                  </span>
                                </>
                              )}

                              {isChild && (
                                <span style={{
                                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                                  background: 'var(--accent-warning, #ed8936)',
                                  color: 'white',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: '0.625rem',
                                  fontWeight: '700',
                                  flexShrink: 0
                                }}>
                                  CHILD
                                </span>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTasks(prev => prev.filter(id => id !== task.id));
                                  if (designatedParentId === task.id) {
                                    setDesignatedParentId(null);
                                  }
                                }}
                                disabled={isLoading}
                                style={{
                                  padding: 'var(--spacing-xs)',
                                  fontSize: '0.75rem',
                                  background: 'transparent',
                                  border: '1px solid var(--accent-error)',
                                  color: 'var(--accent-error)',
                                  cursor: isLoading ? 'wait' : 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                  flexShrink: 0
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}

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

                      {/* Info about multi-level restriction */}
                      <div style={{
                        marginTop: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm)',
                        background: showNestingWarning ? 'rgba(229, 62, 62, 0.2)' : 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        color: showNestingWarning ? 'var(--accent-error, #e53e3e)' : 'var(--text-tertiary)',
                        fontWeight: showNestingWarning ? '600' : 'normal',
                        border: showNestingWarning ? '1px solid var(--accent-error, #e53e3e)' : 'none',
                        transition: 'all 0.2s ease',
                        animation: showNestingWarning ? 'wave 0.5s ease-in-out 2' : 'none'
                      }}>
                        Note: Google Tasks only supports one level of subtasks. Tasks with parents cannot be parents, and tasks with children cannot become subtasks.
                      </div>
                      <style>{`
                        @keyframes wave {
                          0%, 100% { transform: translateX(0); }
                          25% { transform: translateX(-5px); }
                          75% { transform: translateX(5px); }
                        }
                      `}</style>
                    </div>
                  )}
                </>
              )}

              {/* Reorder Children Mode */}
              {operationMode === 'reorderChildren' && (
                <>
                  {selectedTasks.length === 0 ? (
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
                      Select a parent task to reorder its children.
                    </div>
                  ) : selectedTasks.length > 1 ? (
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
                      Select exactly ONE parent task to reorder its children.
                    </div>
                  ) : !hasChildren(selectedTasks[0]) ? (
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
                      Selected task has no children to reorder.
                    </div>
                  ) : (
                    <div style={{
                      padding: 'var(--spacing-md)',
                      background: 'rgba(49, 130, 206, 0.05)',
                      border: '2px solid var(--accent-primary)',
                      borderRadius: 'var(--radius-md)',
                      maxHeight: '500px',
                      overflowY: 'auto'
                    }}>
                      <p style={{
                        margin: '0 0 var(--spacing-md) 0',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Children of <strong>{getTaskById(reorderParentId)?.title}</strong> ({childrenOrder.length}):
                      </p>

                      {childrenOrder.map((childId, index) => {
                        const child = getTaskById(childId);
                        if (!child) return null;

                        const isFirst = index === 0;
                        const isLast = index === childrenOrder.length - 1;

                        return (
                          <div
                            key={childId}
                            style={{
                              padding: 'var(--spacing-sm)',
                              marginBottom: 'var(--spacing-xs)',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.875rem',
                              display: 'flex',
                              gap: 'var(--spacing-md)',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{
                              minWidth: '24px',
                              fontWeight: '700',
                              color: 'var(--accent-primary)',
                              fontSize: '0.75rem',
                              textAlign: 'center'
                            }}>
                              {index + 1}
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
                              {child.title}
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexShrink: 0 }}>
                              <button
                                onClick={() => handleMoveChildUp(childId)}
                                disabled={isFirst || isLoading}
                                style={{
                                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                                  fontSize: '0.875rem',
                                  background: isFirst ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                                  border: '1px solid var(--border-color)',
                                  color: isFirst ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                  cursor: isFirst || isLoading ? 'not-allowed' : 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                  opacity: isFirst ? 0.5 : 1
                                }}
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => handleMoveChildDown(childId)}
                                disabled={isLast || isLoading}
                                style={{
                                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                                  fontSize: '0.875rem',
                                  background: isLast ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                                  border: '1px solid var(--border-color)',
                                  color: isLast ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                  cursor: isLast || isLoading ? 'not-allowed' : 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                  opacity: isLast ? 0.5 : 1
                                }}
                                title="Move down"
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
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

    </div>
  );
}

export default ParentChild;
