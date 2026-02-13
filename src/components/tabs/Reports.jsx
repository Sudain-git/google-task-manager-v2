import { useState, useEffect } from 'react';
import { taskAPI } from '../../utils/taskApi';

function Reports() {
  const [taskLists, setTaskLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [loadingLists, setLoadingLists] = useState(true);

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
        <h2>Reports</h2>
        <p>View reports and analytics.</p>
      </div>

      {/* Task List Selection */}
      <div className="form-section">
        <h3>Select Task List</h3>
        <div className="form-group">
          <label htmlFor="task-list">Task List</label>
          <select
            id="task-list"
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
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
    </div>
  );
}

export default Reports;
