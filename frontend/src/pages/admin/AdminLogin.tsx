import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { login } from '../../services/authService';

const initialForm = {
  username: '',
  password: '',
};

function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const username = formData.username.trim();
    const password = formData.password.trim();

    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await login(username, password);

      localStorage.setItem('adminToken', response.token);
      localStorage.setItem('admin', JSON.stringify(response.admin));

      navigate('/admin', { replace: true });
    } catch (loginError) {
      const message =
        loginError instanceof Error && loginError.message
          ? loginError.message
          : 'Invalid username or password.';

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f9fc',
        padding: '24px',
        fontFamily: 'Segoe UI, Arial, sans-serif',
        color: '#0f172a',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
          padding: 28,
        }}
      >
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#475569',
              fontWeight: 700,
            }}
          >
            Hospital Pricing
          </p>
          <h1
            style={{
              margin: '10px 0 0',
              fontSize: '2rem',
              color: '#0f172a',
            }}
          >
            Admin Login
          </h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
            <span>Username</span>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter username"
              autoComplete="username"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#0f172a',
                fontSize: 15,
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              autoComplete="current-password"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#0f172a',
                fontSize: 15,
              }}
            />
          </label>

          {error && (
            <div
              style={{
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#b91c1c',
                borderRadius: 10,
                padding: '10px 12px',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '13px 16px',
              border: 'none',
              borderRadius: 10,
              background: '#0f766e',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
