import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isAdminUser, canViewData, getAllowedRoutes } from './services/roleService';
import { Loader2 } from 'lucide-react';

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

  if (profile && profile.onboarding_completed === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  
  if (profile && profile.onboarding_completed !== false && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  // Verificação de admin
  if (requiredRole && requiredRole === 'admin' && !isAdminUser(profile?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Se requer acesso específico (visualização), e não é admin, redireciona
  if (requireAccess && !canViewData(profile?.role)) {
    // Operador tentando acessar rota restrita - redireciona para hora-máquina
    return <Navigate to="/hora-maquina" replace />;
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
          <Route path="/orcamentos"       element={<ProtectedRoute><Orcamento /></ProtectedRoute>} />
          <Route path="/orcamentos/novo"  element={<ProtectedRoute><OrcamentoForm /></ProtectedRoute>} />
          <Route path="/orcamentos/:id"   element={<ProtectedRoute><OrcamentoForm /></ProtectedRoute>} />

          {/* Hora-Máquina */}
          <Route path="/hora-maquina" element={<ProtectedRoute><HoraMaquinaPage /></ProtectedRoute>} />

          {/* Relatório para o Cliente */}
          <Route path="/relatorio-cliente" element={<ProtectedRoute><RelatorioCliente /></ProtectedRoute>} />

          {/* WhatsApp Bot Inbox - apenas admin */}
          <Route path="/whatsapp-inbox" element={<ProtectedRoute requireAccess><WhatsAppInbox /></ProtectedRoute>} />

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
