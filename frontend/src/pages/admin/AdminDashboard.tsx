import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { clearAdminSession, getStoredAdmin, getStoredAdminToken } from '../../services/authService';
import AppHeader from '../../components/layout/AppHeader';

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
    <>
      <AppHeader role="Admin" onLogout={handleLogout} />
      <main className="app-page">
        <div className="app-page__inner">
          <div className="page-intro">
            <p className="eyebrow">Configuration centre</p>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">Welcome, {admin?.username ?? 'Admin'}. Manage treatment pricing, services, and review every configuration change.</p>
          </div>
          <div className="admin-grid">
            <button className="summary-card summary-card--button" type="button" onClick={() => navigate('/admin/pricing')}>
              <span className="summary-card__label">Pricing Configuration</span>
              <strong className="summary-card__value">Manage rates</strong>
              <span className="helper">Review and update treatment rates</span>
            </button>
            <button className="summary-card summary-card--button" type="button" onClick={() => navigate('/admin/services')}>
              <span className="summary-card__label">Additional Services</span>
              <strong className="summary-card__value">Manage services</strong>
              <span className="helper">Maintain available care services</span>
            </button>
            <button className="summary-card summary-card--button" type="button" onClick={() => navigate('/admin/audit-logs')}>
              <span className="summary-card__label">Audit History</span>
              <strong className="summary-card__value">Review changes</strong>
              <span className="helper">Trace administrative activity</span>
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

export default AdminDashboard;
