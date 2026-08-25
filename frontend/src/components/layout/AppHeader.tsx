import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getStoredAdmin, logout } from '../../services/authService';

type AppHeaderProps = {
  role: 'User' | 'Admin';
  onLogout?: () => void;
};

export default function AppHeader({ role, onLogout }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = role === 'User' ? getStoredAdmin() : null;
  const handleLogout = onLogout ?? (role === 'Admin' ? () => logout(navigate) : undefined);

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <Link className="brand" to={role === 'Admin' ? '/admin' : '/doctor'} aria-label="Institute of Applied Dermatology">
            <img src="/images/iad-logo.png" alt="Institute of Applied Dermatology" />
          </Link>
          <div className="app-header__tools">
            {role === 'User' && currentUser && (
              <span className="doctor-identity">
                <strong>{currentUser.name}</strong>
                <small>{currentUser.designation}</small>
              </span>
            )}
            <span className="role-label"><span className="role-dot" />{role}</span>
            {handleLogout ? (
              <button className="text-button" type="button" onClick={handleLogout}>
                Log out
              </button>
            ) : <span className="text-button" aria-label="Doctor logout">Log out</span>}
          </div>
        </div>
      </header>
      {role === 'Admin' ? <AdminNavigation /> : <nav className="app-nav" aria-label="Calculator navigation"><div className="app-nav__inner"><Link className={`app-nav__link${location.pathname === '/doctor' ? ' app-nav__link--active' : ''}`} to="/doctor">Calculator</Link></div></nav>}
    </>
  );
}

function AdminNavigation() {
  const location = useLocation();
  const links = [
    ['/admin', 'Dashboard'],
    ['/admin/pricing', 'Pricing Management'],
    ['/admin/services', 'Additional Services'],
    ['/admin/users', 'Users'],
    ['/admin/doctors', 'Doctors'],
    ['/admin/audit-logs', 'Audit Logs'],
  ];

  return (
    <nav className="app-nav" aria-label="Admin navigation">
      <div className="app-nav__inner">
        {links.map(([href, label]) => <Link key={href} className={`app-nav__link${location.pathname === href ? ' app-nav__link--active' : ''}`} to={href}>{label}</Link>)}
      </div>
    </nav>
  );
}
