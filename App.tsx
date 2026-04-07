import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

// ── Novos módulos ──────────────────────────────────────────────────────────────
import { Orcamento } from './pages/Orcamento';
import { OrcamentoForm } from './pages/OrcamentoForm';
import { HoraMaquinaPage } from './pages/HoraMaquina';
import { RelatorioCliente } from './pages/RelatorioCliente';
import { Onboarding } from './pages/Onboarding';
import { WhatsAppInbox } from './pages/WhatsAppInbox';

import { Loader2 } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string }> = ({ children, requiredRole }) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark text-white">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (profile && profile.onboarding_completed === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  
  if (profile && profile.onboarding_completed !== false && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
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
          {/* ── Públicas ── */}
          <Route path="/login"           element={<Login />} />
          <Route path="/signup"          element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* ── Onboarding ── */}
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

          {/* ── Dashboard ── */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* ── IA ── */}
          <Route path="/chat"        element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
          <Route path="/aichat"      element={<Navigate to="/chat" replace />} />

          {/* ── Agenda ── */}
          <Route path="/schedule"          element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/schedule/new"      element={<ProtectedRoute><ScheduleForm /></ProtectedRoute>} />
          <Route path="/schedule/edit/:id" element={<ProtectedRoute><ScheduleForm /></ProtectedRoute>} />

          {/* ── Manutenção ── */}
          <Route path="/maintenance"          element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
          <Route path="/maintenance/new"      element={<ProtectedRoute><MaintenanceForm /></ProtectedRoute>} />
          <Route path="/maintenance/edit/:id" element={<ProtectedRoute><MaintenanceForm /></ProtectedRoute>} />

          {/* ── Frota ── */}
          <Route path="/fleet/*"              element={<ProtectedRoute><Fleet /></ProtectedRoute>} />
          <Route path="/fleet/:id/history"  element={<ProtectedRoute><MaintenanceHistory /></ProtectedRoute>} />

          {/* ── Equipe ── */}
          <Route path="/employees"          element={<ProtectedRoute><Employees /></ProtectedRoute>} />
          <Route path="/employees/new"      element={<ProtectedRoute><EmployeeForm /></ProtectedRoute>} />
          <Route path="/employees/edit/:id" element={<ProtectedRoute><EmployeeForm /></ProtectedRoute>} />
          <Route path="/employees/:id"      element={<ProtectedRoute><EmployeeDetails /></ProtectedRoute>} />

          {/* ── Obra / RDO ── */}
          <Route path="/rdo"      element={<ProtectedRoute><RDO /></ProtectedRoute>} />
          <Route path="/rdo/new"  element={<ProtectedRoute><RDOForm /></ProtectedRoute>} />

          {/* ── Financeiro / Relatórios ── */}
          <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />

          {/* ── Ordens de Serviço ── */}
          <Route path="/service-orders"           element={<ProtectedRoute><ServiceOrderList /></ProtectedRoute>} />
          <Route path="/service-orders/new"       element={<ProtectedRoute><ServiceOrderForm /></ProtectedRoute>} />
          <Route path="/service-orders/:id"       element={<ProtectedRoute><ServiceOrderForm /></ProtectedRoute>} />
          <Route path="/service-orders/:id/receipt" element={<ProtectedRoute><ServiceOrderReceipt /></ProtectedRoute>} />

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* ── NOVOS MÓDULOS ─────────────────────────────────────────────── */}
          {/* ────────────────────────────────────────────────────────────────── */}

          {/* Orçamentos */}
          <Route path="/orcamentos"       element={<ProtectedRoute><Orcamento /></ProtectedRoute>} />
          <Route path="/orcamentos/novo"  element={<ProtectedRoute><OrcamentoForm /></ProtectedRoute>} />
          <Route path="/orcamentos/:id"   element={<ProtectedRoute><OrcamentoForm /></ProtectedRoute>} />

          {/* Hora-Máquina */}
          <Route path="/hora-maquina" element={<ProtectedRoute><HoraMaquinaPage /></ProtectedRoute>} />

          {/* Relatório para o Cliente */}
          <Route path="/relatorio-cliente" element={<ProtectedRoute><RelatorioCliente /></ProtectedRoute>} />

          {/* WhatsApp Bot Inbox */}
          <Route path="/whatsapp-inbox" element={<ProtectedRoute><WhatsAppInbox /></ProtectedRoute>} />

          {/* ── Configurações ── */}
          <Route path="/settings"               element={<ProtectedRoute requiredRole="admin"><Settings /></ProtectedRoute>} />
          <Route path="/settings/profile"       element={<ProtectedRoute><SettingsProfile /></ProtectedRoute>} />
          <Route path="/settings/company"       element={<ProtectedRoute requiredRole="admin"><SettingsCompany /></ProtectedRoute>} />
          <Route path="/settings/notifications" element={<ProtectedRoute><SettingsNotifications /></ProtectedRoute>} />
          <Route path="/settings/security"      element={<ProtectedRoute><SettingsSecurity /></ProtectedRoute>} />
          <Route path="/settings/integrations"  element={<ProtectedRoute requiredRole="admin"><SettingsIntegrations /></ProtectedRoute>} />
          <Route path="/settings/projects"      element={<ProtectedRoute requiredRole="admin"><SettingsProjects /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
