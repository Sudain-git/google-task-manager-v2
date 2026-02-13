/**
 * Google Tasks API Wrapper
 * 
 * Provides a clean interface for interacting with Google Tasks API
 * Handles authentication, error handling, and rate limiting
 */

import { googleAuth } from '../auth/GoogleAuth';

class TaskAPI {
  constructor() {
    this.batchDelay = 100; // Base delay between API calls in ms
    this.maxRetries = 6;
    this.currentDelay = 0;
    this.onDelayChange = null;
    this.onThresholdsChange = null;
  }

  /**
   * Update and broadcast the current delay value
   */
  _setDelay(value) {
    this.currentDelay = value;
    this.onDelayChange?.(value);
  }

  /**
   * Broadcast adaptive-backoff thresholds to the UI
   */
  _setThresholds(data) {
    this.onThresholdsChange?.(data);
  }

  /**
   * Get all task lists
   */
  async getTaskLists() {
    try {
      const response = await window.gapi.client.tasks.tasklists.list({
        maxResults: 100
      });
      
      return response.result.items || [];
    } catch (error) {
      console.error('[API] Failed to get task lists:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get tasks from a specific list
   * @param {string} taskListId - The task list ID
   * @param {boolean} showCompleted - Include completed tasks
   * @param {boolean} showHidden - Include hidden tasks
   */
  async getTasks(taskListId, showCompleted = false, showHidden = false) {
    try {
      const response = await window.gapi.client.tasks.tasks.list({
        tasklist: taskListId,
        maxResults: 100,
        showCompleted: showCompleted,
        showHidden: showHidden
      });
      
      return response.result.items || [];
    } catch (error) {
      console.error('[API] Failed to get tasks:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Insert a new task
   * @param {string} taskListId - The task list ID
   * @param {Object} task - Task object with title, notes, due, etc.
   */
  async insertTask(taskListId, task) {
    try {
      const response = await window.gapi.client.tasks.tasks.insert({
        tasklist: taskListId,
        resource: task
      });
      
      return response.result;
    } catch (error) {
      console.error('[API] Failed to insert task:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Update an existing task
   * @param {string} taskListId - The task list ID
   * @param {string} taskId - The task ID
   * @param {Object} updates - Fields to update
   */
  async updateTask(taskListId, taskId, updates) {
    try {
      // First, get the current task to have all required fields
      const getResponse = await window.gapi.client.tasks.tasks.get({
        tasklist: taskListId,
        task: taskId
      });
      
      const currentTask = getResponse.result;
      
      // Merge updates with current task data
      const updatedTask = {
        ...currentTask,
        ...updates
      };
      
      // Now update with the complete task object
      const response = await window.gapi.client.tasks.tasks.update({
        tasklist: taskListId,
        task: taskId,
        resource: updatedTask
      });
      
      return response.result;
    } catch (error) {
      console.error('[API] Failed to update task:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Move a task to a different position, parent, or list
   * @param {string} taskListId - The source task list ID
   * @param {string} taskId - The task ID to move
   * @param {string} parent - New parent task ID (optional)
   * @param {string} previous - Previous sibling task ID (optional)
   * @param {string} destinationTasklist - Destination list ID for cross-list moves (optional)
   */
  async moveTask(taskListId, taskId, parent = null, previous = null, destinationTasklist = null) {
    try {
      const params = {
        tasklist: taskListId,
        task: taskId
      };

      if (parent) params.parent = parent;
      if (previous) params.previous = previous;
      if (destinationTasklist) params.destinationTasklist = destinationTasklist;

      const response = await window.gapi.client.tasks.tasks.move(params);
      return response.result;
    } catch (error) {
      console.error('[API] Failed to move task:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Bulk move tasks to a different list with rate limiting and retry logic
   * @param {string} sourceListId - The source task list ID
   * @param {string} destinationListId - The destination task list ID
   * @param {Array} taskIds - Array of task IDs to move
   * @param {Function} onProgress - Progress callback (current, total, currentTaskTitle)
   * @param {boolean} stopOnFailure - Stop processing if a task fails (default: true)
   */
  async bulkMoveTasks(sourceListId, destinationListId, taskIds, onProgress = null, stopOnFailure = true) {
    const results = {
      successful: [],
      failed: [],
      stopped: false
    };

    let currentDelay = this.batchDelay;
    const maxRetries = this.maxRetries;
    this._setDelay(currentDelay);

    console.log(`[API] Starting bulk move of ${taskIds.length} tasks with ${currentDelay}ms delay and ${maxRetries} max retries`);
    console.log(`[API] Stop on failure: ${stopOnFailure}`);

    let consecutiveErrors = 0;
    let rateLimitHits = 0;
    let sustainableDelay = this.batchDelay;
    const maxConsecutiveErrors = 5;

    for (let i = 0; i < taskIds.length; i++) {
      const taskId = taskIds[i];
      let retries = 0;
      let success = false;
      let lastError = null;

      while (!success) {
        try {
          const result = await this.moveTask(sourceListId, taskId, null, null, destinationListId);

          results.successful.push({ taskId, result });
          success = true;
          consecutiveErrors = 0;
          if (rateLimitHits > 0) rateLimitHits--;

          // Gradually speed up if no errors
          if (rateLimitHits === 0 && currentDelay > sustainableDelay) {
            currentDelay = Math.max(sustainableDelay, Math.round(currentDelay * 0.9));
            this._setDelay(currentDelay);
          }

        } catch (error) {

          lastError = error;
          consecutiveErrors++;

          const errorMsg = error.message || error.result?.error?.message || error.toString() || '';

          // Check if it's a rate limit error
          const isRateLimit = errorMsg.includes('Rate limit') ||
              errorMsg.includes('429') ||
              errorMsg.includes('403') ||
              errorMsg.includes('quota') ||
              error.status === 429 ||
              error.status === 403;

          if (isRateLimit) {
            rateLimitHits++;
            if (rateLimitHits === 1) {
              sustainableDelay = Math.min(Math.max(sustainableDelay, Math.ceil(currentDelay * 1.2)), 3000);
            }
            console.warn(`[API] Rate limit on task ${i + 1}/${taskIds.length} (rate limit hit #${rateLimitHits}, floor: ${sustainableDelay}ms):`, errorMsg || 'Unknown error');


            currentDelay = Math.min(Math.ceil(currentDelay * 2), 3000);
            this._setDelay(currentDelay);

            const backoffDelay = Math.min(1000 + 1000 * rateLimitHits, 10000);
            console.log(`[API] Backing off for ${backoffDelay}ms before retry...`);
            await this.delay(backoffDelay);

          } else {
            retries++;
            console.warn(`[API] Error on task ${i + 1}/${taskIds.length} (attempt ${retries}/${maxRetries}):`, errorMsg || 'Unknown error');
            await this.delay(this.batchDelay * Math.pow(2, retries));

            if (retries >= maxRetries) {
              const failureMsg = errorMsg || 'Unknown error after maximum retries';
              results.failed.push({ taskId, error: failureMsg });
              console.error(`[API] Failed to move task after ${retries} attempts:`, taskId);

              if (stopOnFailure) {
                console.error('[API] Stopping bulk move due to failure');
                results.stopped = true;
              }
              break;
            }
          }

          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.warn(`[API] ${consecutiveErrors} consecutive errors, pausing for 5 seconds...`);
            await this.delay(5000);
            consecutiveErrors = 0;
          }
        }
      }

      // If we failed and should stop, break out of loop
      if (!success && stopOnFailure) {
        break;
      }

      if (onProgress) {
        onProgress(i + 1, taskIds.length);
      }

      if (i < taskIds.length - 1) {
        await this.delay(currentDelay);
      }
    }

    this._setDelay(0);

    console.log(`[API] Bulk move ${results.stopped ? 'STOPPED' : 'complete'}: ${results.successful.length} successful, ${results.failed.length} failed`);

    return results;
  }

/**
   * Bulk insert tasks with rate limiting and retry logic
   * @param {string} taskListId - The task list ID
   * @param {Array} tasks - Array of task objects
   * @param {Function} onProgress - Progress callback (current, total)
   */
  async bulkInsertTasks(taskListId, tasks, onProgress = null) {
    const results = {
      successful: [],
      failed: []
    };

    let currentDelay = this.batchDelay;
    const maxRetries = this.maxRetries;
    this._setDelay(currentDelay);

    console.log(`[API] Starting bulk insert of ${tasks.length} tasks with ${currentDelay}ms delay and ${maxRetries} max retries`);

    let consecutiveErrors = 0;
    let rateLimitHits = 0;
    let sustainableDelay = this.batchDelay;
    const maxConsecutiveErrors = 5;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      let retries = 0;
      let success = false;
      let lastError = null;

      while (!success) {
        try {
          const result = await this.insertTask(taskListId, task);

          results.successful.push({ task: result, original: task });
          success = true;
          consecutiveErrors = 0;
          if (rateLimitHits > 0) rateLimitHits--;

          // Gradually speed up if no errors
          if (rateLimitHits === 0 && currentDelay > sustainableDelay) {
            currentDelay = Math.max(sustainableDelay, Math.round(currentDelay * 0.9));
            this._setDelay(currentDelay);
          }

        } catch (error) {

          lastError = error;
          consecutiveErrors++;

          const errorMsg = error.message || error.toString() || '';

          // Check if it's a rate limit error
          const isRateLimit = errorMsg.includes('Rate limit') ||
              errorMsg.includes('429') ||
              errorMsg.includes('403') ||
              errorMsg.includes('quota') ||
              error.status === 429 ||
              error.status === 403;

          if (isRateLimit) {
            rateLimitHits++;
            if (rateLimitHits === 1) {
              sustainableDelay = Math.min(Math.max(sustainableDelay, Math.ceil(currentDelay * 1.2)), 3000);
            }
            console.warn(`[API] Rate limit on task ${i + 1}/${tasks.length} (rate limit hit #${rateLimitHits}, floor: ${sustainableDelay}ms):`, errorMsg || 'Unknown error');


            currentDelay = Math.min(Math.ceil(currentDelay * 2), 3000);
            this._setDelay(currentDelay);

            const backoffDelay = Math.min(1000 + 1000 * rateLimitHits, 10000);
            console.log(`[API] Backing off for ${backoffDelay}ms before retry...`);
            await this.delay(backoffDelay);

          } else {
            retries++;
            console.warn(`[API] Error on task ${i + 1}/${tasks.length} (attempt ${retries}/${maxRetries}):`, errorMsg || 'Unknown error');
            await this.delay(this.batchDelay * Math.pow(2, retries));

            if (retries >= maxRetries) {
              results.failed.push({ task, error: lastError.message });
              console.error(`[API] Failed to insert task after ${retries} attempts:`, task.title);
              break;
            }
          }

          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.warn(`[API] ${consecutiveErrors} consecutive errors, pausing for 5 seconds...`);
            await this.delay(5000);
            consecutiveErrors = 0;
          }
        }
      }

      // Progress callback
      if (onProgress) {
        onProgress(i + 1, tasks.length);
      }

      // Delay between requests (skip on last item)
      if (i < tasks.length - 1) {
        await this.delay(currentDelay);
      }
    }

    this._setDelay(0);

    console.log(`[API] Bulk insert complete: ${results.successful.length} successful, ${results.failed.length} failed`);

    return results;
  }


/**
   * Bulk update tasks with rate limiting and retry logic
   * Optimized: Fetches all tasks upfront to avoid double API calls
   * @param {string} taskListId - The task list ID
   * @param {Array} updates - Array of {taskId, updates} objects
   * @param {Function} onProgress - Progress callback (current, total)
   * @param {boolean} stopOnFailure - Stop processing if a task fails (default: true)
   * @param {Array|null} prefetchedTasks - Optional pre-fetched tasks array to avoid redundant fetch
   */
  async bulkUpdateTasks(taskListId, updates, onProgress = null, stopOnFailure = true, prefetchedTasks = null) {
    const results = {
      successful: [],
      failed: [],
      stopped: false
    };

    let taskMap;
    if (prefetchedTasks) {
      taskMap = new Map();
      prefetchedTasks.forEach(task => taskMap.set(task.id, task));
      console.log(`[API] Using pre-fetched task map with ${taskMap.size} tasks`);
    } else {
      console.log('[API] Pre-fetching all tasks from list for bulk update...');
      const allTasks = await this.getAllTasksFromList(taskListId, false, false);
      taskMap = new Map();
      allTasks.forEach(task => taskMap.set(task.id, task));
      console.log(`[API] Created task map with ${taskMap.size} tasks`);
    }

    let currentDelay = this.batchDelay;
    const maxRetries = this.maxRetries;
    this._setDelay(currentDelay);

    console.log(`[API] Starting bulk update of ${updates.length} tasks with ${currentDelay}ms delay and ${maxRetries} max retries`);
    console.log(`[API] Stop on failure: ${stopOnFailure}`);

    let consecutiveErrors = 0;
    let rateLimitHits = 0;
    let sustainableDelay = this.batchDelay;
    const maxConsecutiveErrors = 5;

    for (let i = 0; i < updates.length; i++) {
      const { taskId, updates: taskUpdates } = updates[i];
      
      // Get current task from our pre-fetched map
      const currentTask = taskMap.get(taskId);
      
      if (!currentTask) {
        console.warn(`[API] Task ${taskId} not found in pre-fetched tasks`);
        results.failed.push({ taskId, error: 'Task not found in list' });
        
        if (stopOnFailure) {
          console.error('[API] Stopping due to task not found');
          results.stopped = true;
          break;
        }
        
        if (onProgress) onProgress(i + 1, updates.length);
        continue;
      }

      // Merge updates with current task
      const mergedTask = {
        ...currentTask,
        ...taskUpdates
      };

      let retries = 0;
      let success = false;
      let lastError = null;

      while (!success) {
        try {
          // Update with merged task object
          const response = await window.gapi.client.tasks.tasks.update({
            tasklist: taskListId,
            task: taskId,
            resource: mergedTask
          });


          results.successful.push({ task: response.result });
          success = true;
          consecutiveErrors = 0;
          if (rateLimitHits > 0) rateLimitHits--;

          // Gradually speed up if no errors
          if (rateLimitHits === 0 && currentDelay > sustainableDelay) {
            currentDelay = Math.max(sustainableDelay, Math.round(currentDelay * 0.9));
            this._setDelay(currentDelay);
          }

        } catch (error) {

          lastError = error;
          consecutiveErrors++;

          const errorMsg = error.message || error.result?.error?.message || error.toString() || '';

          // Check if it's a rate limit error
          const isRateLimit = errorMsg.includes('Rate limit') ||
              errorMsg.includes('429') ||
              errorMsg.includes('403') ||
              errorMsg.includes('quota') ||
              error.status === 429 ||
              error.status === 403;

          if (isRateLimit) {
            rateLimitHits++;
            if (rateLimitHits === 1) {
              sustainableDelay = Math.min(Math.max(sustainableDelay, Math.ceil(currentDelay * 1.2)), 3000);
            }
            console.warn(`[API] Rate limit on task ${i + 1}/${updates.length} (rate limit hit #${rateLimitHits}, floor: ${sustainableDelay}ms):`, errorMsg || 'Unknown error');


            currentDelay = Math.min(Math.ceil(currentDelay * 2), 3000);
            this._setDelay(currentDelay);

            const backoffDelay = Math.min(1000 + 1000 * rateLimitHits, 10000);
            console.log(`[API] Backing off for ${backoffDelay}ms before retry...`);
            await this.delay(backoffDelay);

          } else {
            retries++;
            console.warn(`[API] Error on task ${i + 1}/${updates.length} (attempt ${retries}/${maxRetries}):`, errorMsg || 'Unknown error');
            await this.delay(this.batchDelay * Math.pow(2, retries));

            if (retries >= maxRetries) {
              const failureMsg = errorMsg || 'Unknown error after maximum retries';
              results.failed.push({ taskId, error: failureMsg });
              console.error(`[API] Failed to update task after ${retries} attempts:`, taskId);

              if (stopOnFailure) {
                console.error('[API] Stopping bulk update due to failure');
                results.stopped = true;
              }
              break;
            }
          }

          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.warn(`[API] ${consecutiveErrors} consecutive errors, pausing for 5 seconds...`);
            await this.delay(5000);
            consecutiveErrors = 0;
          }
        }
      }

      // If we failed and should stop, break out of loop
      if (!success && stopOnFailure) {
        break;
      }

      if (onProgress) {
        onProgress(i + 1, updates.length);
      }

      if (i < updates.length - 1) {
        await this.delay(currentDelay);
      }
    }

    this._setDelay(0);

    console.log(`[API] Bulk update ${results.stopped ? 'STOPPED' : 'complete'}: ${results.successful.length} successful, ${results.failed.length} failed`);

    return results;
  }

  /**
   * Get ALL tasks from a list (handles pagination)
   * @param {string} taskListId - The task list ID
   * @param {boolean} showCompleted - Include completed tasks
   * @param {boolean} showHidden - Include hidden tasks
   */
  async getAllTasksFromList(taskListId, showCompleted = false, showHidden = false) {
    let allTasks = [];
    let pageToken = null;

    console.log('[API] Fetching all tasks from list...');

    do {
      try {
        const params = {
          tasklist: taskListId,
          maxResults: 100, // Maximum per page
          showCompleted: showCompleted,
          showHidden: showHidden
        };

        if (pageToken) {
          params.pageToken = pageToken;
        }

        const response = await window.gapi.client.tasks.tasks.list(params);

        const tasks = response.result.items || [];
        allTasks = allTasks.concat(tasks);
        
        pageToken = response.result.nextPageToken;
        
        console.log(`[API] Fetched ${tasks.length} tasks (total: ${allTasks.length})`);

      } catch (error) {
        console.error('[API] Failed to fetch tasks page:', error);
        throw this.handleError(error);
      }
    } while (pageToken);

    console.log(`[API] Fetched all ${allTasks.length} tasks from list`);
    return allTasks;
  }

  /**
   * EXPERIMENTAL — Unified bulk operation with adaptive backoff
   * Consolidates move/insert/update retry + rate-limit logic into one place.
   *
   * @param {Array} items - Array of work items (task IDs, task objects, update descriptors, etc.)
   * @param {Function} apiFn - Async callback that performs one API call: (item, index) => Promise<result>
   * @param {Object} options
   * @param {Function} options.onProgress - Progress callback: (current, total) => void
   * @param {boolean}  options.stopOnFailure - Abort remaining items on non-retryable failure (default: true)
   * @returns {{ successful: Array, failed: Array, stopped: boolean }}
   */
  async bulkOperation(items, apiFn, { onProgress = null, stopOnFailure = true } = {}) {
    const results = {
      successful: [],
      failed: [],
      stopped: false
    };

    // Initial parameters
    const initialPeak = 3000;
    const initialFloor = 200;
    const initialDelay = 1000;
    const initialAverage = Math.round((initialPeak + initialFloor) / 2);

    // Adaptive state
    let currentPeak = initialPeak;
    let currentFloor = initialFloor;
    let currentDelay = initialDelay;
    let currentAverage = initialAverage;
    let sustainableDelay = initialDelay;

    // Counters
    let retries = 0;
    let rateLimitHits = 0;
    const maxRetries = this.maxRetries;

    // Rate limit hit timestamps for recent-hits tracking
    const rateLimitTimestamps = [];

    this._setDelay(currentDelay);

    console.log(`[API] Bulk operation: ${items.length} items`);
    console.log(`[API] Initial: delay=${initialDelay}ms, floor=${initialFloor}ms, peak=${initialPeak}ms, avg=${initialAverage}ms`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      retries = 0;
      let success = false;
      let lastError = null;

      while (!success) {
        try {
          const result = await apiFn(item, i);

          results.successful.push({ item, result });
          success = true;
          retries = 0;
          if (rateLimitHits > 0) rateLimitHits--;

          // Update peak on success
          if (currentDelay > currentPeak) {
            currentPeak = currentDelay;
          }

          // Speed-up on every success (zone-based reduction is gentle enough)
          if (currentDelay >= currentAverage) {
            // Zone 1 (red): Above average — aggressive 20% reduction to quickly find sustainable level
            currentDelay = Math.round(currentDelay * 0.8);
          } else if (currentDelay >= sustainableDelay) {
            // Zone 2 (yellow): Between average and sustainable — Decrease by 1000ms to approach sustainable level more cautiously
            currentDelay = currentDelay - 1000;

          } else if (currentDelay > currentFloor) {
            // Zone 3 (green): Below sustainable, above floor - crawling up by 1ms to find true floor without risking rate limit
            currentDelay -= 1;     
          }
          // At or below floor: no change

          // Clamp to floor
          currentDelay = Math.max(currentDelay, currentFloor);

          // Recalculate all derived thresholds
          currentAverage = Math.round((currentPeak + currentFloor) / 2);

          this._setDelay(currentDelay);
          this._setThresholds({ peak: currentPeak, average: currentAverage, sustainable: sustainableDelay, floor: currentFloor });

        } catch (error) {

          lastError = error;

          const errorMsg = error.message || error.result?.error?.message || error.toString() || '';

          const isRateLimit = errorMsg.includes('Rate limit') ||
              errorMsg.includes('429') ||
              errorMsg.includes('403') ||
              errorMsg.includes('quota') ||
              error.status === 429 ||
              error.status === 403;

          if (isRateLimit) {
            rateLimitHits++;
            rateLimitTimestamps.push(Date.now());

            // Each 403 increments floor by 1ms, capped at currentAverage
            currentFloor = Math.min(currentFloor + 1, currentAverage);

            // each 403 adjusts average to midpoint between current floor and peak
            currentAverage = Math.round((currentPeak + currentFloor) / 2);

            // Sustainable delay is previous value +10ms
            sustainableDelay += 10;

            console.warn(`[API] Rate limit ${i + 1}/${items.length} (#${rateLimitHits}) floor=${currentFloor}ms sust=${sustainableDelay}ms:`, errorMsg);


            // increase current delay by 50%
            currentDelay = Math.ceil(currentDelay * 1.5);

            this._setDelay(currentDelay);
            this._setThresholds({ peak: currentPeak, average: currentAverage, sustainable: sustainableDelay, floor: currentFloor });

            // Wait a separate backoff (grows with consecutive hits, min 2s, max 10s)
            const backoffDelay = Math.min(1000 + 1000 * rateLimitHits, 10000);
            console.log(`[API] Backing off for ${backoffDelay}ms before retry...`);
            await this.delay(backoffDelay);

          } else {
            // Transient error — exponential backoff based on retries
            retries++;
            console.warn(`[API] Error ${i + 1}/${items.length} (${retries}/${maxRetries}):`, errorMsg);
            await this.delay(this.batchDelay * Math.pow(2, retries));

            if (retries >= maxRetries) {
              results.failed.push({ item, error: errorMsg || 'Unknown error after maximum retries' });
              console.error(`[API] Failed item after ${retries} attempts`);

              if (stopOnFailure) {
                console.error('[API] Stopping bulk operation');
                results.stopped = true;
              }
              break;
            }
          }
        }
      }

      if (!success && stopOnFailure) {
        break;
      }

      // Determine zone color
      let zone;
      if (currentDelay >= currentAverage) {
        zone = 'red';
      } else if (currentDelay >= sustainableDelay) {
        zone = 'yellow';
      } else {
        zone = 'green';
      }

      // Count recent rate limit hits (last 5 minutes)
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const recentHits = rateLimitTimestamps.filter(t => t > fiveMinAgo).length;

      if (onProgress) {
        onProgress(i + 1, items.length, {
          currentDelay,
          currentPeak,
          currentFloor,
          currentAverage,
          sustainableDelay,
          zone,
          recentRateLimitHits: recentHits,
          rateLimitHits
        });
      }

      if (i < items.length - 1) {
        await this.delay(currentDelay);
      }
    }

    this._setDelay(0);
    this._setThresholds(null);

    console.log(`[API] Bulk op ${results.stopped ? 'STOPPED' : 'done'}: ${results.successful.length} ok, ${results.failed.length} failed`);

    return results;
  }

  /**
   * Delay helper for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle API errors
   */
 /**
   * Handle API errors
   */
  handleError(error) {
    // Ensure error always has a message
    const message = error.message || error.result?.error?.message || 'Unknown error occurred';
    
    // Check for authentication errors
    if (error.status === 401) {
      return new Error('Authentication expired. Please sign in again.');
    }

    // Check for rate limiting
    if (error.status === 429 || error.status === 403) {
      return new Error('Rate limit exceeded. Please wait a moment and try again.');
    }

    // Generic error
    return new Error(message);
  }
}

// Export singleton instance
export const taskAPI = new TaskAPI();
