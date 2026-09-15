import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
const SignUp = React.lazy(() => import('./pages/SignUp').then(module => ({ default: module.SignUp })));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword').then(module => ({ default: module.ForgotPassword })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Fleet = React.lazy(() => import('./pages/Fleet').then(module => ({ default: module.Fleet })));
const RDO = React.lazy(() => import('./pages/RDO').then(module => ({ default: module.RDO })));
const Finance = React.lazy(() => import('./pages/Finance').then(module => ({ default: module.Finance })));
const Settings = React.lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const SettingsProfile = React.lazy(() => import('./pages/SettingsProfile').then(module => ({ default: module.SettingsProfile })));
const SettingsCompany = React.lazy(() => import('./pages/SettingsCompany').then(module => ({ default: module.SettingsCompany })));
const SettingsNotifications = React.lazy(() => import('./pages/SettingsNotifications').then(module => ({ default: module.SettingsNotifications })));
const SettingsSecurity = React.lazy(() => import('./pages/SettingsSecurity').then(module => ({ default: module.SettingsSecurity })));
const SettingsIntegrations = React.lazy(() => import('./pages/SettingsIntegrations').then(module => ({ default: module.SettingsIntegrations })));
const AIChat = React.lazy(() => import('./pages/AIChat').then(module => ({ default: module.AIChat })));
const Schedule = React.lazy(() => import('./pages/Schedule').then(module => ({ default: module.Schedule })));
const ScheduleForm = React.lazy(() => import('./pages/ScheduleForm').then(module => ({ default: module.ScheduleForm })));
const MaintenanceForm = React.lazy(() => import('./pages/MaintenanceForm').then(module => ({ default: module.MaintenanceForm })));
const MaintenanceHistory = React.lazy(() => import('./pages/MaintenanceHistory').then(module => ({ default: module.MaintenanceHistory })));
const Maintenance = React.lazy(() => import('./pages/Maintenance').then(module => ({ default: module.Maintenance })));
const Employees = React.lazy(() => import('./pages/Employees').then(module => ({ default: module.Employees })));
const EmployeeForm = React.lazy(() => import('./pages/EmployeeForm').then(module => ({ default: module.EmployeeForm })));
const EmployeeDetails = React.lazy(() => import('./pages/EmployeeDetails').then(module => ({ default: module.EmployeeDetails })));
const FleetForm = React.lazy(() => import('./pages/FleetForm').then(module => ({ default: module.FleetForm })));
const RDOForm = React.lazy(() => import('./pages/RDOForm').then(module => ({ default: module.RDOForm })));
const Reports = React.lazy(() => import('./pages/Reports').then(module => ({ default: module.Reports })));
const SettingsProjects = React.lazy(() => import('./pages/SettingsProjects').then(module => ({ default: module.SettingsProjects })));
const ServiceOrderList = React.lazy(() => import('./pages/ServiceOrderList').then(module => ({ default: module.ServiceOrderList })));
const ServiceOrderForm = React.lazy(() => import('./pages/ServiceOrderForm').then(module => ({ default: module.ServiceOrderForm })));
const ServiceOrderReceipt = React.lazy(() => import('./pages/ServiceOrderReceipt').then(module => ({ default: module.ServiceOrderReceipt })));

// ── Novos módulos ──────────────────────────────────────────────────────────────
const Orcamento = React.lazy(() => import('./pages/Orcamento').then(module => ({ default: module.Orcamento })));
const OrcamentoForm = React.lazy(() => import('./pages/OrcamentoForm').then(module => ({ default: module.OrcamentoForm })));
const HoraMaquinaPage = React.lazy(() => import('./pages/HoraMaquina').then(module => ({ default: module.HoraMaquinaPage })));
const RelatorioCliente = React.lazy(() => import('./pages/RelatorioCliente').then(module => ({ default: module.RelatorioCliente })));
const Onboarding = React.lazy(() => import('./pages/Onboarding').then(module => ({ default: module.Onboarding })));
const WhatsAppInbox = React.lazy(() => import('./pages/WhatsAppInbox').then(module => ({ default: module.WhatsAppInbox })));

import { Loader2 } from 'lucide-react';
import { isAdminUser, canViewData } from './services/roleService';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string; requireAccess?: boolean }> = ({ 
  children, 
  requiredRole,
  requireAccess = false
}) => {
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

  if (!profile) return <div className="p-8 text-white">Não foi possível carregar seu perfil. Recarregue a página para tentar novamente.</div>;
  if (!profile.company_id && location.pathname !== '/settings/profile') return <div className="p-8 text-white">Seu vínculo com a empresa precisa ser verificado pelo responsável do TerraGes. Seus dados permanecem preservados.</div>;

  if (profile && profile.onboarding_completed === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  
  if (profile && profile.onboarding_completed !== false && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  // Verificação de admin (requiredRole)
  if (requiredRole && requiredRole === 'admin' && !isAdminUser(profile?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Se requer acesso específico (visualização), e não é admin, redireciona
  if (requireAccess && !canViewData(profile?.role)) {
    return <Navigate to="/hora-maquina" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <React.Suspense fallback={<div className="tg-loading" role="status"><Loader2 size={22} className="tg-spin" />Carregando tela…</div>}>
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
          <Route path="/chat"        element={<ProtectedRoute requireAccess><AIChat /></ProtectedRoute>} />
          <Route path="/aichat"      element={<Navigate to="/chat" replace />} />

          {/* ── Agenda ── */}
          <Route path="/schedule"          element={<ProtectedRoute requireAccess><Schedule /></ProtectedRoute>} />
          <Route path="/schedule/new"      element={<ProtectedRoute><ScheduleForm /></ProtectedRoute>} />
          <Route path="/schedule/edit/:id" element={<ProtectedRoute><ScheduleForm /></ProtectedRoute>} />

          {/* ── Manutenção ── */}
          <Route path="/maintenance"          element={<ProtectedRoute requireAccess><Maintenance /></ProtectedRoute>} />
          <Route path="/maintenance/new"      element={<ProtectedRoute><MaintenanceForm /></ProtectedRoute>} />
          <Route path="/maintenance/edit/:id" element={<ProtectedRoute><MaintenanceForm /></ProtectedRoute>} />

          {/* ── Frota ── */}
          <Route path="/fleet/*"              element={<ProtectedRoute requireAccess><Fleet /></ProtectedRoute>} />
          <Route path="/fleet/:id/history"  element={<ProtectedRoute requireAccess><MaintenanceHistory /></ProtectedRoute>} />

          {/* ── Equipe ── */}
          <Route path="/employees"          element={<ProtectedRoute requireAccess><Employees /></ProtectedRoute>} />
          <Route path="/employees/new"      element={<ProtectedRoute requireAccess><EmployeeForm /></ProtectedRoute>} />
          <Route path="/employees/edit/:id" element={<ProtectedRoute requireAccess><EmployeeForm /></ProtectedRoute>} />
          <Route path="/employees/:id"      element={<ProtectedRoute requireAccess><EmployeeDetails /></ProtectedRoute>} />

          {/* ── Obra / RDO ── */}
          <Route path="/rdo"      element={<ProtectedRoute requireAccess><RDO /></ProtectedRoute>} />
          <Route path="/rdo/new"  element={<ProtectedRoute><RDOForm /></ProtectedRoute>} />

          {/* ── Financeiro / Relatórios ── */}
          <Route path="/finance" element={<ProtectedRoute requireAccess><Finance /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute requireAccess><Reports /></ProtectedRoute>} />

          {/* ── Ordens de Serviço ── */}
          <Route path="/service-orders"           element={<ProtectedRoute><ServiceOrderList /></ProtectedRoute>} />
          <Route path="/service-orders/new"       element={<ProtectedRoute><ServiceOrderForm /></ProtectedRoute>} />
          <Route path="/service-orders/:id"       element={<ProtectedRoute><ServiceOrderForm /></ProtectedRoute>} />
          <Route path="/service-orders/:id/receipt" element={<ProtectedRoute><ServiceOrderReceipt /></ProtectedRoute>} />

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* ── NOVOS MÓDULOS ─────────────────────────────────────────────── */}
          {/* ────────────────────────────────────────────────────────────────── */}

          {/* Orçamentos */}
          <Route path="/orcamentos"       element={<ProtectedRoute requireAccess><Orcamento /></ProtectedRoute>} />
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
        </React.Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
