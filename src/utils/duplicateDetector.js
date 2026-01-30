/**
 * Duplicate Detection Utility
 * 
 * Detects duplicate tasks based on exact title or note matching
 */

/**
 * Find duplicate tasks in a list
 * @param {Array} tasks - Array of task objects
 * @param {string} matchBy - 'title' or 'notes'
 * @returns {Object} - { duplicates: Array, unique: Array }
 */
export function findDuplicates(tasks, matchBy = 'title') {
  const seen = new Map();
  const duplicates = [];
  const unique = [];

  for (const task of tasks) {
    const key = matchBy === 'title' ? task.title : task.notes;
    
    // Skip if no value to match
    if (!key || key.trim() === '') {
      unique.push(task);
      continue;
    }

    const normalizedKey = key.trim().toLowerCase();

    if (seen.has(normalizedKey)) {
      // Duplicate found
      duplicates.push({
        task,
        duplicateOf: seen.get(normalizedKey),
        matchedOn: matchBy,
        matchValue: key
      });
    } else {
      // First occurrence
      seen.set(normalizedKey, task);
      unique.push(task);
    }
  }

  return { duplicates, unique };
}

/**
 * Filter out duplicates from a task list
 * @param {Array} tasks - Array of task objects
 * @param {string} matchBy - 'title' or 'notes'
 * @returns {Array} - Array of unique tasks
 */
export function filterDuplicates(tasks, matchBy = 'title') {
  const { unique } = findDuplicates(tasks, matchBy);
  return unique;
}

/**
 * Get duplicate statistics
 * @param {Array} tasks - Array of task objects
 * @returns {Object} - Statistics about duplicates
 */
export function getDuplicateStats(tasks) {
  const titleDuplicates = findDuplicates(tasks, 'title');
  const notesDuplicates = findDuplicates(tasks, 'notes');

  return {
    total: tasks.length,
    uniqueByTitle: titleDuplicates.unique.length,
    duplicatesByTitle: titleDuplicates.duplicates.length,
    uniqueByNotes: notesDuplicates.unique.length,
    duplicatesByNotes: notesDuplicates.duplicates.length
  };
}

/**
 * Check if a task would be a duplicate
 * @param {Object} newTask - Task to check
 * @param {Array} existingTasks - Array of existing tasks
 * @param {string} matchBy - 'title' or 'notes'
 * @returns {boolean} - True if duplicate
 */
export function isDuplicate(newTask, existingTasks, matchBy = 'title') {
  const key = matchBy === 'title' ? newTask.title : newTask.notes;
  
  if (!key || key.trim() === '') {
    return false;
  }

  const normalizedKey = key.trim().toLowerCase();

  return existingTasks.some(task => {
    const existingKey = matchBy === 'title' ? task.title : task.notes;
    if (!existingKey) return false;
    return existingKey.trim().toLowerCase() === normalizedKey;
  });
}
