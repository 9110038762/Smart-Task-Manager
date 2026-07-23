import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Calendar, User, Tag, Bell, Info } from 'lucide-react';

const TaskModal = ({ isOpen, onClose, task, onSave }) => {
  const { user, token, apiUrl } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Todo');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('General');
  const [assigneeId, setAssigneeId] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  
  const [usersList, setUsersList] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditing = !!task;
  const isManagerOrAdmin = user && (user.role === 'Manager' || user.role === 'Admin');
  // Regular users can only edit status
  const canEditAllFields = !isEditing || isManagerOrAdmin;

  // Fetch list of users for assignment (Managers & Admins only)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isOpen || !isManagerOrAdmin) return;
      try {
        const res = await fetch(`${apiUrl}/admin/users`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.success) {
          setUsersList(data.data);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };

    fetchUsers();
  }, [isOpen, user, token]);

  // Load task data if editing
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'Todo');
      setPriority(task.priority || 'Medium');
      // Format date for datetime-local or date input
      const formattedDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
      setDueDate(formattedDate);
      setCategory(task.category || 'General');
      setAssigneeId(task.assignee ? (task.assignee._id || task.assignee) : '');
      
      // Fetch active reminder for this task if editing
      const fetchReminder = async () => {
        try {
          const res = await fetch(`${apiUrl}/reminders`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (data.success) {
            const activeReminder = data.data.find(r => r.task && r.task._id === task._id && !r.isSent);
            if (activeReminder) {
              // Format for datetime-local input (YYYY-MM-DDTHH:MM)
              const remDate = new Date(activeReminder.reminderTime);
              const tzOffset = remDate.getTimezoneOffset() * 60000; // offset in milliseconds
              const localISODate = new Date(remDate.getTime() - tzOffset).toISOString().slice(0, 16);
              setReminderTime(localISODate);
            } else {
              setReminderTime('');
            }
          }
        } catch (err) {
          console.error('Error fetching reminders:', err);
        }
      };
      fetchReminder();
    } else {
      // Reset fields for creation
      setTitle('');
      setDescription('');
      setStatus('Todo');
      setPriority('Medium');
      setDueDate('');
      setCategory('General');
      setAssigneeId('');
      setReminderTime('');
    }
    setError('');
  }, [task, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title && canEditAllFields) {
      setError('Please add a task title');
      return;
    }
    if (!dueDate && canEditAllFields) {
      setError('Please set a due date');
      return;
    }

    setError('');
    setSaving(true);

    try {
      let taskData;
      if (!canEditAllFields) {
        // Regular user only sends status updates
        taskData = { status };
      } else {
        taskData = {
          title,
          description,
          status,
          priority,
          dueDate: new Date(dueDate),
          category,
          assignee: assigneeId || undefined
        };
      }

      // Save task details (Creates or Updates)
      const method = isEditing ? 'PUT' : 'POST';
      const endpoint = isEditing ? `${apiUrl}/tasks/${task._id}` : `${apiUrl}/tasks`;

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save task');
      }

      const savedTask = data.data;

      // Handle Smart Reminder Creation
      if (reminderTime) {
        const reminderRes = await fetch(`${apiUrl}/reminders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            taskId: savedTask._id,
            reminderTime: new Date(reminderTime),
            channel: 'System'
          })
        });
        const reminderData = await reminderRes.json();
        if (!reminderData.success) {
          console.error('Reminder error:', reminderData.error);
          // Don't fail the whole task save if just the reminder fails, but show alert
        }
      }

      onSave(savedTask);
      onClose();
    } catch (err) {
      setError(err.message || 'Error occurred while saving task');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ animation: 'fadeIn 0.25s ease' }}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Task Details' : 'Create New Task'}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="error-message">
            <Info size={16} style={{ marginRight: '0.5rem' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!canEditAllFields && (
            <div className="error-message" style={{ background: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.25)', color: '#67e8f9' }}>
              <Info size={16} style={{ marginRight: '0.5rem' }} />
              <span>You only have permissions to change the task status.</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Task Title</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Implement JWT Authentication"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEditAllFields || saving}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="Provide a detailed task description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEditAllFields || saving}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={saving}
              >
                <option value="Todo">Todo</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Done">Done</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-control form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={!canEditAllFields || saving}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Calendar size={14} /> Due Date
              </label>
              <input
                type="date"
                className="form-control"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canEditAllFields || saving}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Tag size={14} /> Category
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Backend, Frontend, Docs"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!canEditAllFields || saving}
              />
            </div>
          </div>

          {isManagerOrAdmin && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <User size={14} /> Assignee
              </label>
              <select
                className="form-control form-select"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={saving}
              >
                <option value="">Unassigned</option>
                {usersList.map(u => (
                  <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1rem', marginTop: '1rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#c084fc' }}>
              <Bell size={14} /> Set Smart Reminder (Real-Time Notification)
            </label>
            <input
              type="datetime-local"
              className="form-control"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              disabled={saving}
            />
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Schedule a local alarm. We will dispatch a real-time toast alert at this exact time if you are online.
            </p>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
