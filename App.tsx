
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { Fleet } from './pages/Fleet';
import { RDO } from './pages/RDO';
import { Finance } from './pages/Finance';
import { Settings } from './pages/Settings';
import { SettingsProfile } from './pages/SettingsProfile';
import { SettingsCompany } from './pages/SettingsCompany';
import { SettingsNotifications } from './pages/SettingsNotifications';
import { SettingsSecurity } from './pages/SettingsSecurity';
import { SettingsIntegrations } from './pages/SettingsIntegrations';
import { AIChat } from './pages/AIChat';
import { IntelligenceHub } from './pages/IntelligenceHub';
import { Schedule } from './pages/Schedule';
import { ScheduleForm } from './pages/ScheduleForm';
import { MaintenanceForm } from './pages/MaintenanceForm';
import { MaintenanceHistory } from './pages/MaintenanceHistory';
import { Maintenance } from './pages/Maintenance';
import { Employees } from './pages/Employees';
import { EmployeeForm } from './pages/EmployeeForm';
import { EmployeeDetails } from './pages/EmployeeDetails';
import { FleetForm } from './pages/FleetForm';
import { RDOForm } from './pages/RDOForm';
import { Reports } from './pages/Reports';
import { SettingsProjects } from './pages/SettingsProjects';
import { ServiceOrderList } from './pages/ServiceOrderList';
import { ServiceOrderForm } from './pages/ServiceOrderForm';
import { ServiceOrderReceipt } from './pages/ServiceOrderReceipt';
import { Loader2 } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string }> = ({ children, requiredRole }) => {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark text-white">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && profile?.role !== requiredRole && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Private Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
          <Route path="/intelligence" element={<ProtectedRoute><IntelligenceHub /></ProtectedRoute>} />
          <Route path="/aichat" element={<Navigate to="/chat" replace />} />

          <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/schedule/new" element={<ProtectedRoute><ScheduleForm /></ProtectedRoute>} />
          <Route path="/schedule/edit/:id" element={<ProtectedRoute><ScheduleForm /></ProtectedRoute>} />

          <Route path="/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
          <Route path="/maintenance/new" element={<ProtectedRoute><MaintenanceForm /></ProtectedRoute>} />
          <Route path="/maintenance/edit/:id" element={<ProtectedRoute><MaintenanceForm /></ProtectedRoute>} />

          <Route path="/fleet" element={<ProtectedRoute><Fleet /></ProtectedRoute>} />
          <Route path="/fleet/add" element={<ProtectedRoute><FleetForm /></ProtectedRoute>} />
          <Route path="/fleet/edit/:id" element={<ProtectedRoute><FleetForm /></ProtectedRoute>} />
          <Route path="/fleet/:id/history" element={<ProtectedRoute><MaintenanceHistory /></ProtectedRoute>} />

          <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
          <Route path="/employees/new" element={<ProtectedRoute><EmployeeForm /></ProtectedRoute>} />
          <Route path="/employees/edit/:id" element={<ProtectedRoute><EmployeeForm /></ProtectedRoute>} />
          <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetails /></ProtectedRoute>} />

          <Route path="/rdo" element={<ProtectedRoute><RDO /></ProtectedRoute>} />
          <Route path="/rdo/new" element={<ProtectedRoute><RDOForm /></ProtectedRoute>} />

          <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />

          <Route path="/service-orders" element={<ProtectedRoute><ServiceOrderList /></ProtectedRoute>} />
          <Route path="/service-orders/new" element={<ProtectedRoute><ServiceOrderForm /></ProtectedRoute>} />
          <Route path="/service-orders/:id" element={<ProtectedRoute><ServiceOrderForm /></ProtectedRoute>} />
          <Route path="/service-orders/:id/receipt" element={<ProtectedRoute><ServiceOrderReceipt /></ProtectedRoute>} />

          <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><Settings /></ProtectedRoute>} />
          <Route path="/settings/profile" element={<ProtectedRoute><SettingsProfile /></ProtectedRoute>} />
          <Route path="/settings/company" element={<ProtectedRoute requiredRole="admin"><SettingsCompany /></ProtectedRoute>} />
          <Route path="/settings/notifications" element={<ProtectedRoute><SettingsNotifications /></ProtectedRoute>} />
          <Route path="/settings/security" element={<ProtectedRoute><SettingsSecurity /></ProtectedRoute>} />
          <Route path="/settings/integrations" element={<ProtectedRoute requiredRole="admin"><SettingsIntegrations /></ProtectedRoute>} />
          <Route path="/settings/projects" element={<ProtectedRoute requiredRole="admin"><SettingsProjects /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
