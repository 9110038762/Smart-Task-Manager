import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, User, Mail, Key, Shield, AlertCircle, Loader } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('User');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await register(name, email, password, role);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Failed to register account');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-panel">
        <div className="auth-header">
          <div className="brand" style={{ justifyContent: 'center', marginBottom: '1rem', cursor: 'default' }}>
            <UserPlus size={28} style={{ color: '#8b5cf6' }} />
            <span>Smart Task Manager</span>
          </div>
          <h2>Create Account</h2>
          <p>Sign up to start organizing tasks intelligently</p>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={18} style={{ marginRight: '0.5rem', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={18} className="search-icon" style={{ left: '0.85rem' }} />
              <input
                type="text"
                id="name"
                className="form-control search-input"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} className="search-icon" style={{ left: '0.85rem' }} />
              <input
                type="email"
                id="email"
                className="form-control search-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <Key size={18} className="search-icon" style={{ left: '0.85rem' }} />
              <input
                type="password"
                id="password"
                className="form-control search-input"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="role">Workplace Role</label>
            <div style={{ position: 'relative' }}>
              <Shield size={18} className="search-icon" style={{ left: '0.85rem' }} />
              <select
                id="role"
                className="form-control search-input form-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
              >
                <option value="User">User (Manage assigned tasks)</option>
                <option value="Manager">Manager (Assign tasks & edit details)</option>
                <option value="Admin">Admin (Full operations + role management)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem' }} disabled={loading}>
            {loading ? (
              <>
                <Loader className="animate-spin" size={18} />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Sign Up</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
