import { useState } from 'react';
import { api } from '../utils/api';

export default function LoginGate({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.auth.login(password);
      if (result?.success) {
        onLoginSuccess();
      } else {
        setError(result?.message || 'Invalid password');
      }
    } catch (err) {
      console.error('Login Error:', err);
      setError('Connection error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-card">
        <div className="login-icon">📖</div>
        <h1 className="login-title">Album Builder</h1>
        <p className="login-subtitle">Internal print-ready PDF tool</p>
        
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          
          <div className="login-input-wrapper">
            <span className="login-input-icon">🔒</span>
            <input
              id="login-password"
              className="input"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          
          <button
            id="login-submit"
            className="btn btn-primary login-btn"
            type="submit"
            disabled={loading || !password}
          >
            {loading ? (
              <><div className="spinner" style={{ borderTopColor: 'white' }}></div> Authenticating...</>
            ) : (
              'Access Tool'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
