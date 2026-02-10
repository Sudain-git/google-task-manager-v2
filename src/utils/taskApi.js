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

    // RPS tracking
    this._rpsTimestamps = [];
    this.currentRps = 0;
    this.onRpsChange = null;

    // TTR tracking
    this._recoveryStartTime = null;
    this.onTtrChange = null;
  }

  /**
   * Update and broadcast the current delay value
   */
  _setDelay(value) {
    this.currentDelay = value;
    this.onDelayChange?.(value);
  }

  _trackRequest() {
    const now = Date.now();
    this._rpsTimestamps.push(now);
    this._rpsTimestamps = this._rpsTimestamps.filter(t => t > now - 5000);
    this.currentRps = Math.round((this._rpsTimestamps.length / 5) * 100) / 100;
    this.onRpsChange?.(this.currentRps);
  }

  _resetRps() {
    this._rpsTimestamps = [];
    this.currentRps = 0;
    this.onRpsChange?.(0);
  }

  _startRecovery() {
    this._recoveryStartTime = Date.now();
    this.onTtrChange?.({ recovering: true, since: this._recoveryStartTime });
  }

  _completeRecovery() {
    if (this._recoveryStartTime) {
      const duration = (Date.now() - this._recoveryStartTime) / 1000;
      this._recoveryStartTime = null;
      this.onTtrChange?.({ recovering: false, duration });
    }
  }

  _resetTtr() {
    this._recoveryStartTime = null;
    this.onTtrChange?.(null);
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
          this._trackRequest();
          this._completeRecovery();
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
          this._trackRequest();
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
            this._startRecovery();

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
    this._resetRps();
    this._resetTtr();
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
          this._trackRequest();
          this._completeRecovery();
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
          this._trackRequest();
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
            this._startRecovery();

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
    this._resetRps();
    this._resetTtr();
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
   */
  async bulkUpdateTasks(taskListId, updates, onProgress = null, stopOnFailure = true) {
    const results = {
      successful: [],
      failed: [],
      stopped: false
    };

    // Fetch all tasks from list upfront
    console.log('[API] Pre-fetching all tasks from list for bulk update...');
    const allTasks = await this.getAllTasksFromList(taskListId, false, false);
    
    // Create map for O(1) lookup
    const taskMap = new Map();
    allTasks.forEach(task => {
      taskMap.set(task.id, task);
    });
    
    console.log(`[API] Created task map with ${taskMap.size} tasks`);

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
          this._trackRequest();
          this._completeRecovery();

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
          this._trackRequest();
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
            this._startRecovery();

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
    this._resetRps();
    this._resetTtr();
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
        this._trackRequest();

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
