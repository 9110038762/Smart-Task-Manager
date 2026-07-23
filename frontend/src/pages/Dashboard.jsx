import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, Plus, Search, Calendar, User, Tag, 
  Trash2, Edit, AlertCircle, Users, CheckSquare, RefreshCw
} from 'lucide-react';
import TaskModal from '../components/TaskModal';
import ReminderToast from '../components/ReminderToast';

const Dashboard = () => {
  const { user, token, logout, apiUrl } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Tab control: 'tasks' or 'admin'
  const [activeTab, setActiveTab] = useState('tasks');
  const [adminUsersList, setAdminUsersList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  // Modal Control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const isManagerOrAdmin = user && (user.role === 'Manager' || user.role === 'Admin');
  const isAdmin = user && user.role === 'Admin';

  // Fetch all tasks
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch admin user list
  const fetchAdminUsers = async () => {
    if (!isAdmin) return;
    setAdminLoading(true);
    setAdminError('');
    try {
      const res = await fetch(`${apiUrl}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setAdminUsersList(data.data);
      } else {
        setAdminError(data.error || 'Failed to load users');
      }
    } catch (err) {
      setAdminError('Network error loading users');
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'admin') {
      fetchAdminUsers();
    }
  }, [activeTab]);

  // Handle task deletion
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`${apiUrl}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => prev.filter(t => t._id !== taskId));
      } else {
        alert(data.error || 'Failed to delete task');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Handle admin role change
  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      const res = await fetch(`${apiUrl}/admin/users/${targetUserId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (data.success) {
        setAdminUsersList(prev => prev.map(u => u._id === targetUserId ? { ...u, role: newRole } : u));
      } else {
        alert(data.error || 'Failed to update user role');
      }
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    // Check permissions
    const taskToMove = tasks.find(t => t._id === taskId);
    if (!taskToMove) return;

    const isCreator = taskToMove.creator._id === user.id || taskToMove.creator === user.id;
    const isAssignee = taskToMove.assignee && (taskToMove.assignee._id === user.id || taskToMove.assignee === user.id);

    if (user.role === 'User' && !isCreator && !isAssignee) {
      alert('You are not authorized to update this task.');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => prev.map(t => t._id === taskId ? data.data : t));
      } else {
        alert(data.error || 'Failed to move task');
      }
    } catch (err) {
      console.error('Error dragging task:', err);
    }
  };

  // Open modal for creating a task
  const handleCreateTaskClick = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  // Open modal for editing a task
  const handleEditTaskClick = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  // Callback when modal saves task
  const handleTaskSaved = (savedTask) => {
    setTasks(prev => {
      const exists = prev.some(t => t._id === savedTask._id);
      if (exists) {
        return prev.map(t => t._id === savedTask._id ? savedTask : t);
      } else {
        return [savedTask, ...prev];
      }
    });
  };

  // Get unique categories for filter
  const categories = ['All', ...new Set(tasks.map(t => t.category).filter(Boolean))];

  // Filter tasks locally
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase()) || 
      (task.description && task.description.toLowerCase().includes(search.toLowerCase()));
    const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'All' || task.category === categoryFilter;
    return matchesSearch && matchesPriority && matchesCategory;
  });

  const getTasksByStatus = (status) => filteredTasks.filter(t => t.status === status);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="app-container">
      {/* Navigation */}
      <nav className="navbar">
        <div className="brand" onClick={() => setActiveTab('tasks')}>
          <CheckSquare size={24} style={{ color: '#8b5cf6' }} />
          <span>Smart Task Manager</span>
        </div>

        <div className="nav-links">
          {isAdmin && (
            <button 
              className={`btn ${activeTab === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab(activeTab === 'tasks' ? 'admin' : 'tasks')}
            >
              <Users size={16} />
              <span>{activeTab === 'tasks' ? 'Team Roles' : 'Tasks Board'}</span>
            </button>
          )}

          <div className="nav-user">
            <span style={{ color: '#cbd5e1' }}>Hi, <strong>{user?.name}</strong></span>
            <span className={`user-badge ${user?.role.toLowerCase()}`}>
              {user?.role}
            </span>
          </div>

          <button className="btn btn-secondary btn-icon" onClick={logout} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Main Dashboard Panel */}
      <main className="dashboard">
        {activeTab === 'tasks' ? (
          <>
            {/* Header controls */}
            <div className="dashboard-header">
              <div className="dashboard-title">
                <h1>Workspace Board</h1>
                <p>Plan, organize, and drag tasks between columns dynamically</p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={fetchTasks} title="Refresh Board">
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button className="btn btn-primary" onClick={handleCreateTaskClick}>
                  <Plus size={16} />
                  <span>Create Task</span>
                </button>
              </div>
            </div>

            {/* Filters panel */}
            <div className="controls-panel glass-panel">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  className="form-control search-input" 
                  placeholder="Search tasks..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <div>
                  <span className="form-label" style={{ display: 'inline', marginRight: '0.5rem', fontSize: '0.75rem' }}>Priority:</span>
                  <select 
                    className="form-control filter-select form-select"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="All">All Priorities</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <span className="form-label" style={{ display: 'inline', marginRight: '0.5rem', fontSize: '0.75rem' }}>Category:</span>
                  <select 
                    className="form-control filter-select form-select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Kanban Columns */}
            {loading ? (
              <div className="empty-state">
                <RefreshCw size={40} className="animate-spin" style={{ color: '#8b5cf6' }} />
                <h3>Loading board tasks...</h3>
              </div>
            ) : (
              <div className="kanban-board">
                {['Todo', 'In Progress', 'Review', 'Done'].map((status) => {
                  const statusKey = status.toLowerCase().replace(' ', '');
                  const columnTasks = getTasksByStatus(status);
                  
                  return (
                    <div 
                      key={status}
                      className="kanban-column"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, status)}
                    >
                      <div className="column-header">
                        <div className="column-title">
                          <span className={`column-indicator ${statusKey}`}></span>
                          <span>{status}</span>
                        </div>
                        <span className="task-count">{columnTasks.length}</span>
                      </div>

                      <div className="column-cards">
                        {columnTasks.length === 0 ? (
                          <div style={{ 
                            fontSize: '0.8rem', 
                            color: '#475569', 
                            textAlign: 'center', 
                            padding: '2rem 1rem',
                            border: '1px dashed rgba(255,255,255,0.05)',
                            borderRadius: '8px'
                          }}>
                            Drop tasks here
                          </div>
                        ) : (
                          columnTasks.map(task => {
                            const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'Done';
                            return (
                              <div 
                                key={task._id} 
                                className="task-card glass-panel"
                                draggable
                                onDragStart={(e) => handleDragStart(e, task._id)}
                              >
                                <div className="task-card-header">
                                  <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                                    {task.priority}
                                  </span>
                                  {task.category && (
                                    <span className="category-tag">{task.category}</span>
                                  )}
                                </div>

                                <div className="task-title">{task.title}</div>
                                {task.description && (
                                  <p className="task-description">{task.description}</p>
                                )}

                                <div className="task-meta">
                                  <div className={`task-date ${isOverdue ? 'overdue' : ''}`}>
                                    <Calendar size={12} />
                                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                  </div>

                                  <div className="task-assignee">
                                    <span style={{ fontSize: '0.7rem' }}>
                                      {task.assignee ? task.assignee.name : 'Unassigned'}
                                    </span>
                                    {task.assignee && (
                                      <div className="assignee-avatar" title={task.assignee.name}>
                                        {getInitials(task.assignee.name)}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="task-actions">
                                  <button className="btn-icon" onClick={() => handleEditTaskClick(task)} title="Edit Task">
                                    <Edit size={14} />
                                  </button>
                                  {isManagerOrAdmin && (
                                    <button className="btn-icon" onClick={() => handleDeleteTask(task._id)} style={{ hover: { color: '#f87171' } }} title="Delete Task">
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Admin View */
          <div className="admin-panel glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)' }}>User Role Control Panel</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Assign system permissions to team members</p>
              </div>
              <button className="btn btn-secondary" onClick={fetchAdminUsers}>
                <RefreshCw size={14} className={adminLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {adminError && (
              <div className="error-message">
                <AlertCircle size={18} style={{ marginRight: '0.5rem' }} />
                <span>{adminError}</span>
              </div>
            )}

            {adminLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <RefreshCw size={30} className="animate-spin" style={{ color: '#8b5cf6' }} />
              </div>
            ) : (
              <div className="user-table-container">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Registration Date</th>
                      <th>Current Access Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsersList.map(u => (
                      <tr key={u._id}>
                        <td style={{ fontWeight: '500' }}>{u.name} {u._id === user.id && <span style={{ color: 'var(--accent-purple)', fontSize: '0.75rem' }}>(You)</span>}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td>
                          {u._id === user.id ? (
                            <span className={`badge-role ${u.role.toLowerCase()}`}>
                              {u.role}
                            </span>
                          ) : (
                            <select
                              className="form-control form-select"
                              value={u.role}
                              onChange={(e) => handleRoleChange(u._id, e.target.value)}
                              style={{ width: '130px', padding: '0.35rem 0.5rem', fontSize: '0.85rem', backgroundColor: 'rgba(15,23,42,0.4)' }}
                            >
                              <option value="User">User</option>
                              <option value="Manager">Manager</option>
                              <option value="Admin">Admin</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Task Modal for Create/Edit */}
      <TaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={selectedTask}
        onSave={handleTaskSaved}
      />

      {/* Toast Reminder Notifications */}
      <ReminderToast />
    </div>
  );
};

export default Dashboard;
