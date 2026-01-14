export interface Machine {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'maintenance' | 'inactive';
  hours: number;
  nextMaintenance: string;
  lastMaintenance: string;
  image: string;
}

export interface RDO {
  id: string;
  date: string;
  operator: string;
  activity: string;
  project: string;
  tags: string[];
  description: string;
  machines: string[];
}

export interface Transaction {
  id: string;
  title: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  status: 'paid' | 'pending';
  category: string;
}

export enum UserRole {
  ADMIN = 'Administrador',
  ENGINEER = 'Engenheiro',
  OPERATOR = 'Operador'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'pending';
  avatar: string;
}

export interface ServiceSchedule {
  id: string;
  title: string;
  type: 'excavation' | 'transport' | 'maintenance' | 'other';
  startTime: string;
  endTime?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  machineId?: string;
  operatorId?: string;
  notes?: string;
}

export interface MaintenanceRecord {
  id: string;
  machineId: string;
  date: string;
  type: 'preventive' | 'corrective' | 'predictive';
  description: string;
  cost: number;
  technician: string;
  hourMeter: number;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'vacation' | 'leave';
  contact: string;
  admissionDate: string;
  certifications: string[];
  avatar: string;
}