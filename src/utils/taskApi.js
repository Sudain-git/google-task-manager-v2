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
    this.maxRetries = 3;
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
      const response = await window.gapi.client.tasks.tasks.update({
        tasklist: taskListId,
        task: taskId,
        resource: updates
      });
      
      return response.result;
    } catch (error) {
      console.error('[API] Failed to update task:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete a task
   * @param {string} taskListId - The task list ID
   * @param {string} taskId - The task ID
   */
  async deleteTask(taskListId, taskId) {
    try {
      await window.gapi.client.tasks.tasks.delete({
        tasklist: taskListId,
        task: taskId
      });
      
      return true;
    } catch (error) {
      console.error('[API] Failed to delete task:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Move a task to a different position or parent
   * @param {string} taskListId - The task list ID
   * @param {string} taskId - The task ID to move
   * @param {string} parent - New parent task ID (optional)
   * @param {string} previous - Previous sibling task ID (optional)
   */
  async moveTask(taskListId, taskId, parent = null, previous = null) {
    try {
      const params = {
        tasklist: taskListId,
        task: taskId
      };
      
      if (parent) params.parent = parent;
      if (previous) params.previous = previous;
      
      const response = await window.gapi.client.tasks.tasks.move(params);
      return response.result;
    } catch (error) {
      console.error('[API] Failed to move task:', error);
      throw this.handleError(error);
    }
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

    // Very conservative delay for large batches to avoid rate limits
    let currentDelay = this.batchDelay;
    let maxRetries = this.maxRetries;
    
    if (tasks.length > 1000) {
      currentDelay = 1000; // 1 second for very large batches
      maxRetries = 5; // More retries for large batches
    } else if (tasks.length > 500) {
      currentDelay = 750; // 750ms
      maxRetries = 4;
    } else if (tasks.length > 100) {
      currentDelay = 350; // 350ms
      maxRetries = 3;
    }

    console.log(`[API] Starting bulk insert of ${tasks.length} tasks with ${currentDelay}ms delay and ${maxRetries} max retries`);

    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      let retries = 0;
      let success = false;
      let lastError = null;

      while (retries < maxRetries && !success) {
        try {
          const result = await this.insertTask(taskListId, task);
          results.successful.push({ task: result, original: task });
          success = true;
          consecutiveErrors = 0; // Reset on success
          
          // Gradually speed up if no errors (but stay conservative)
          if (tasks.length > 100 && currentDelay > this.batchDelay && consecutiveErrors === 0) {
            currentDelay = Math.max(this.batchDelay * 2, currentDelay - 50);
          }
          
        } catch (error) {
          lastError = error;
          retries++;
          consecutiveErrors++;
          
          console.warn(`[API] Error on task ${i + 1}/${tasks.length} (attempt ${retries}/${maxRetries}):`, error.message);
          
          // Check if it's a rate limit error
          if (error.message.includes('Rate limit') || 
              error.message.includes('429') || 
              error.message.includes('403') ||
              error.message.includes('quota')) {
            
            console.warn(`[API] Rate limit/quota hit, slowing down significantly...`);
            
            // Dramatically increase delay for rate limits
            currentDelay = Math.min(currentDelay * 2.5, 5000); // Up to 5 seconds between requests
            
            // Wait even longer before retry (proportional to retry attempt)
            const backoffDelay = currentDelay * (retries + 1) * 2;
            console.log(`[API] Backing off for ${backoffDelay}ms before retry...`);
            await this.delay(backoffDelay);
            
          } else {
            // Other error, use exponential backoff
            await this.delay(this.batchDelay * Math.pow(2, retries));
          }
          
          // If too many consecutive errors, pause significantly
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.warn(`[API] ${consecutiveErrors} consecutive errors, pausing for 10 seconds...`);
            await this.delay(10000);
            consecutiveErrors = 0;
          }
          
          if (retries >= maxRetries) {
            results.failed.push({ task, error: lastError.message });
            console.error(`[API] Failed to insert task after ${retries} attempts:`, task.title);
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

    console.log(`[API] Bulk insert complete: ${results.successful.length} successful, ${results.failed.length} failed`);
    
    return results;
  }


  /**
   * Bulk update tasks
   * @param {string} taskListId - The task list ID
   * @param {Array} updates - Array of {taskId, updates} objects
   * @param {Function} onProgress - Progress callback
   */
  async bulkUpdateTasks(taskListId, updates, onProgress = null) {
    const results = {
      successful: [],
      failed: []
    };

    for (let i = 0; i < updates.length; i++) {
      const { taskId, updates: taskUpdates } = updates[i];
      let retries = 0;
      let success = false;

      while (retries < this.maxRetries && !success) {
        try {
          const result = await this.updateTask(taskListId, taskId, taskUpdates);
          results.successful.push({ task: result });
          success = true;
        } catch (error) {
          retries++;
          
          if (retries >= this.maxRetries) {
            results.failed.push({ taskId, error: error.message });
          } else {
            await this.delay(this.batchDelay * Math.pow(2, retries));
          }
        }
      }

      if (onProgress) {
        onProgress(i + 1, updates.length);
      }

      if (i < updates.length - 1) {
        await this.delay(this.batchDelay);
      }
    }

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
  handleError(error) {
    // Check for authentication errors
    if (error.status === 401) {
      return new Error('Authentication expired. Please sign in again.');
    }

    // Check for rate limiting
    if (error.status === 429 || error.status === 403) {
      return new Error('Rate limit exceeded. Please wait a moment and try again.');
    }

    // Generic error
    return new Error(error.message || 'API request failed');
  }
}

// Export singleton instance
export const taskAPI = new TaskAPI();
