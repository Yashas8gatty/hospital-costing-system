import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLogin from './pages/admin/AdminLogin';
import PricingManagement from './pages/admin/PricingManagement';
import ServicesManagement from './pages/admin/ServicesManagement';
import DoctorDashboard from './pages/doctor/DoctorDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DoctorDashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/pricing" element={<PricingManagement />} />
        <Route path="/admin/services" element={<ServicesManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
