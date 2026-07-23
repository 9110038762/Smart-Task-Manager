import React, { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';

const AuthContext = createContext();

const API_URL = 'http://localhost:5005/api';
let socketConnection = null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Establish socket connection for logged in user
  const initSocket = (userId) => {
    if (socketConnection) {
      socketConnection.disconnect();
    }
    
    socketConnection = io('http://localhost:5005');
    socketConnection.emit('register', userId);

    socketConnection.on('reminder_notification', (data) => {
      console.log('Received reminder socket alert:', data);
      setNotifications(prev => [data, ...prev]);
    });

    socketConnection.on('connect_error', (err) => {
      console.log('Socket connection error:', err.message);
    });
  };

  const disconnectSocket = () => {
    if (socketConnection) {
      socketConnection.disconnect();
      socketConnection = null;
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();

        if (data.success) {
          setUser(data.user);
          initSocket(data.user.id);
        } else {
          // Token expired or invalid
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    return () => {
      disconnectSocket();
    };
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      initSocket(data.user.id);
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  };

  const register = async (name, email, password, role) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password, role })
    });
    
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      initSocket(data.user.id);
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setNotifications([]);
    disconnectSocket();
  };

  const clearNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      notifications,
      clearNotification,
      socket: socketConnection,
      apiUrl: API_URL
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export { socketConnection };
