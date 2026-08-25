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

      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));

      navigate(response.user.role === 'ADMIN' ? '/admin' : '/doctor', { replace: true });
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
    <main className="login-page">
      <div className="login-panel">
        <div className="brand">
          <img src="/images/iad-logo.png" alt="Institute of Applied Dermatology" />
        </div>
        <div className="page-intro">
          <p className="eyebrow">Hospital costing</p>
          <h1 className="page-title">Login</h1>
          <p className="page-subtitle">Sign in to continue to hospital costing.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Username</span>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter username"
              autoComplete="username"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </label>

          {error && (
            <div className="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="primary-button"
          >
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default AdminLogin;
