import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, X, Calendar } from 'lucide-react';

const ReminderToast = () => {
  const { notifications, clearNotification } = useAuth();

  if (notifications.length === 0) return null;

  return (
    <div className="toast-container">
      {notifications.map((notif) => (
        <div key={notif.id} className="reminder-toast glass-panel">
          <div className="toast-header">
            <div className="toast-tag">
              <Bell size={14} style={{ color: '#a78bfa' }} />
              <span>Smart Reminder</span>
            </div>
            <button className="toast-close" onClick={() => clearNotification(notif.id)} title="Dismiss">
              <X size={16} />
            </button>
          </div>
          
          <div className="toast-title">{notif.task?.title || 'Task Reminder'}</div>
          {notif.task?.description && (
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0' }}>
              {notif.task.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', alignItems: 'center' }}>
            <div className="task-date" style={{ fontSize: '0.75rem' }}>
              <Calendar size={12} />
              <span>Due: {notif.task?.dueDate ? new Date(notif.task.dueDate).toLocaleDateString() : 'N/A'}</span>
            </div>
            {notif.task?.priority && (
              <span className={`priority-badge ${notif.task.priority.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}>
                {notif.task.priority}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReminderToast;
