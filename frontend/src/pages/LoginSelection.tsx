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
          <h1 className="page-title">Login</h1>
        </div>
        <div className="role-selection" aria-label="Choose application role">
          <button className="role-card" type="button" onClick={() => navigate('/admin/login')}>
            <strong>Application User</strong>
            <span>Sign in with your username and password</span>
          </button>
        </div>
      </div>
    </main>
  );
}