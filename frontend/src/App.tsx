import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLogin from './pages/admin/AdminLogin';
import AuditLogs from './pages/admin/AuditLogs';
import PricingManagement from './pages/admin/PricingManagement';
import ServicesManagement from './pages/admin/ServicesManagement';
import DoctorManagement from './pages/admin/DoctorManagement';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorLogin from './pages/doctor/DoctorLogin';
import LoginSelection from './pages/LoginSelection';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginSelection />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/pricing" element={<PricingManagement />} />
        <Route path="/admin/services" element={<ServicesManagement />} />
        <Route path="/admin/doctors" element={<DoctorManagement />} />
        <Route path="/admin/audit-logs" element={<AuditLogs />} />
        <Route path="/doctor/login" element={<DoctorLogin />} />
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
