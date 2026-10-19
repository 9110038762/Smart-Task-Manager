import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { io } from 'socket.io-client';

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5005';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  // Manage socket connection lifecycle tied to authenticated user
  useEffect(() => {
    if (user?.id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const s = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      const registerUser = () => {
        s.emit('register', user.id);
      };

      s.on('connect', registerUser);
      if (s.connected) {
        registerUser();
      }

      s.on('reminder_notification', (data) => {
        console.log('Received reminder socket alert:', data);
        setNotifications(prev => [data, ...prev]);
      });

      s.on('user_role_updated', (data) => {
        if (data.userId === user.id) {
          setUser(prev => prev ? { ...prev, role: data.role } : null);
        }
      });

      s.on('connect_error', (err) => {
        console.log('Socket connection error:', err.message);
      });

      socketRef.current = s;
      setSocket(s);

      return () => {
        s.disconnect();
        socketRef.current = null;
        setSocket(null);
      };
    } else {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
    }
  }, [user?.id]);

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
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
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
      socket,
      apiUrl: API_URL
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
