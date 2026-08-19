import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { clearAdminSession, getStoredAdmin, getStoredAdminToken } from '../../services/authService';

function AdminDashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = getStoredAdminToken();

    if (!token) {
      navigate('/admin/login', { replace: true });
      return;
    }

    const admin = getStoredAdmin();

    if (!admin) {
      navigate('/admin/login', { replace: true });
    }
  }, [navigate]);

  const admin = getStoredAdmin();

  const handleLogout = () => {
    clearAdminSession();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f9fc',
        padding: '32px 24px',
        fontFamily: 'Segoe UI, Arial, sans-serif',
        color: '#0f172a',
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: '0 auto',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          padding: 28,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
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
              Admin Portal
            </p>
            <h1 style={{ margin: '10px 0 8px', fontSize: '2rem' }}>Admin Dashboard</h1>
            <p style={{ margin: 0, color: '#475569', fontSize: '1.05rem' }}>
              Welcome, {admin?.username ?? 'Admin'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/pricing')}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid #0f766e',
                background: '#0f766e',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Pricing Management
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/services')}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid #0f766e',
                background: '#0f766e',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Additional Services
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
