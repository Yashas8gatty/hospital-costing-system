import { useNavigate } from 'react-router-dom';

export default function LoginSelection() {
  const navigate = useNavigate();

  return (
    <main className="login-page selection-page">
      <div className="selection-panel">
        <div className="brand selection-brand">
          <img src="/images/iad-logo.png" alt="Institute of Applied Dermatology" />
        </div>
        <div className="page-intro">
          <p className="eyebrow">Hospital costing</p>
          <h1 className="page-title">Hospital Costing</h1>
        </div>
        <div className="role-selection" aria-label="Choose application role">
          <button className="role-card" type="button" onClick={() => navigate('/doctor/login')}>
            <strong>Doctor</strong>
            <span>Continue as Doctor</span>
          </button>
          <button className="role-card" type="button" onClick={() => navigate('/admin/login')}>
            <strong>Admin</strong>
            <span>Continue as Administrator</span>
          </button>
        </div>
      </div>
    </main>
  );
}