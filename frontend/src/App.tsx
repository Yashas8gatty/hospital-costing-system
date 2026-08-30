import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLogin from './pages/admin/AdminLogin';
import AuditLogs from './pages/admin/AuditLogs';
import PricingManagement from './pages/admin/PricingManagement';
import ServicesManagement from './pages/admin/ServicesManagement';
import DoctorManagement from './pages/admin/DoctorManagement';
import UserManagement from './pages/admin/UserManagement';
import BillingHistory from './pages/admin/BillingHistory';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import CalculationReportPlaceholder from './pages/doctor/CalculationReportPlaceholder';
import { getStoredAdmin, getStoredAdminToken } from './services/authService';

function RequireAdmin({ children }: { children: ReactNode }) {
  const user = getStoredAdmin();
  return getStoredAdminToken() && user?.role === 'ADMIN'
    ? children
    : <Navigate to="/" replace />;
}

function RequireUser({ children }: { children: ReactNode }) {
  return getStoredAdminToken() ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/pricing" element={<RequireAdmin><PricingManagement /></RequireAdmin>} />
        <Route path="/admin/services" element={<RequireAdmin><ServicesManagement /></RequireAdmin>} />
        <Route path="/admin/doctors" element={<RequireAdmin><DoctorManagement /></RequireAdmin>} />
        <Route path="/admin/users" element={<RequireAdmin><UserManagement /></RequireAdmin>} />
        <Route path="/admin/audit-logs" element={<RequireAdmin><AuditLogs /></RequireAdmin>} />
        <Route path="/admin/billing-history" element={<RequireAdmin><BillingHistory /></RequireAdmin>} />
        <Route path="/doctor/login" element={<Navigate to="/" replace />} />
        <Route path="/doctor" element={<RequireUser><DoctorDashboard /></RequireUser>} />
        <Route path="/doctor/report/:id" element={<RequireUser><CalculationReportPlaceholder /></RequireUser>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
