/**
 * Sistema de Permissões por Role
 * ==========================
 * Admin/Gerente: acesso total (inserir + visualizar)
 * Operador: apenas inserir dados, sem acesso a visualizações
 */

import type { UserRole } from './userService';

export const ADMIN_ROLES: UserRole[] = ['admin', 'gestor'];
export const OPERATOR_ROLE = 'operator';

/**
 * Verifica se é admin/gerente (acesso total)
 */
export function isAdminUser(role: string | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role.toLowerCase() as UserRole);
}

/**
 * Verifica se é operador (apenas inserção)
 */
export function isOperator(role: string | undefined): boolean {
  if (!role) return false;
  return role.toLowerCase() === OPERATOR_ROLE;
}

/**
 * Pode visualizar dados (dashboard, relatórios, financeiras, agenda)
 */
export function canViewData(role: string | undefined): boolean {
  return isAdminUser(role);
}

/**
 * Pode inserir/editar dados (OS, hora-máquina, RDO)
 */
export function canInsertData(role: string | undefined): boolean {
  if (!role) return false;
  return isAdminUser(role) || isOperator(role);
}

/**
 * Pode aprovar/rejeitar ações pendentes
 */
export function canApproveActions(role: string | undefined): boolean {
  return isAdminUser(role);
}

/**
 * Pode acessar configurações do sistema
 */
export function canAccessSettings(role: string | undefined): boolean {
  return isAdminUser(role);
}

/**
 * Pode gerenciar equipe (funcionários)
 */
export function canManageTeam(role: string | undefined): boolean {
  return isAdminUser(role);
}

/**
 * Pode visualizar relatórios
 */
export function canViewReports(role: string | undefined): boolean {
  return isAdminUser(role);
}

/**
 * Pode visualizar financeiro
 */
export function canViewFinance(role: string | undefined): boolean {
  return isAdminUser(role);
}

/**
 * Pode ver agenda completa
 */
export function canViewSchedule(role: string | undefined): boolean {
  return isAdminUser(role);
}

/**
 * Label amigável para o role
 */
export function getRoleLabel(role: string | undefined): string {
  if (!role) return 'Usuário';
  const labels: Record<string, string> = {
    admin: 'Administrador',
    gestor: 'Gestor',
    operator: 'Operador',
    proprietario: 'Proprietário',
    dono: 'Dono',
    engenheiro: 'Engenheiro',
    operador: 'Operador',
  };
  return labels[role.toLowerCase()] || role;
}

/**
 * Itens de menu disponíveis por role
 * Retorna lista de caminhos que o usuário pode acessar
 */
export function getAllowedRoutes(role: string | undefined): string[] {
  const adminRoutes = [
    '/dashboard',
    '/chat',
    '/schedule',
    '/fleet',
    '/maintenance',
    '/employees',
    '/service-orders',
    '/orcamentos',
    '/hora-maquina',
    '/relatorio-cliente',
    '/rdo',
    '/whatsapp-inbox',
    '/finance',
    '/reports',
    '/settings/projects',
    '/settings',
  ];

  const operatorRoutes = [
    '/dashboard',
    '/hora-maquina',
    '/service-orders/new',
    '/whatsapp-inbox',
    '/settings/profile',
  ];

  return isAdminUser(role) ? adminRoutes : operatorRoutes;
}