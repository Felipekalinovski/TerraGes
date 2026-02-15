
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Phone, Mail, Briefcase, Calendar, Award, Edit2, Clock, MapPin, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeeService, Employee } from '../services/employeeService';

export const EmployeeDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployee();
  }, [id]);

  const loadEmployee = async () => {
    try {
      if (!id) return;
      setLoading(true);
      const data = await employeeService.getById(id);
      setEmployee(data);
    } catch (error) {
      console.error('Error loading employee details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Carregando..." showBack hideNav={false}>
        <div className="flex h-screen items-center justify-center text-primary">
          <Loader2 className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (!employee) {
    return (
      <Layout title="Colaborador não encontrado" showBack hideNav={false}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500 gap-4">
          <UserX size={48} />
          <p>Colaborador não encontrado ou removido.</p>
          <button onClick={() => navigate('/employees')} className="text-primary hover:underline">
            Voltar para lista
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Perfil do Colaborador" showBack hideNav={false}>
      <div className="relative">
        <div className="h-32 bg-gradient-to-r from-primary/20 to-brand-dark border-b border-white/10"></div>
        <div className="px-4 pb-4 -mt-12 flex justify-between items-end">
          <div className="size-24 rounded-full bg-gray-700 bg-cover bg-center border-4 border-brand-dark shadow-xl"
            style={{ backgroundImage: `url('${employee.image_url || 'https://i.pravatar.cc/300?u=' + employee.id}')` }}>
          </div>
          <button
            onClick={() => navigate(`/employees/edit/${employee.id}`)}
            className="bg-surface-dark border border-white/10 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 mb-2 hover:bg-white/5 transition-colors"
          >
            <Edit2 size={14} /> Editar
          </button>
        </div>
      </div>

      <div className="px-4 space-y-6 pb-24">

        {/* Header Info */}
        <div>
          <h1 className="text-2xl font-bold text-white">{employee.name}</h1>
          <p className="text-primary font-medium">{employee.role}</p>
          <div className="flex items-center gap-2 mt-2">
            {employee.status === 'active' && <span className="bg-positive/20 text-positive text-[10px] px-2 py-0.5 rounded-full font-bold">Ativo</span>}
            {employee.status === 'vacation' && <span className="bg-warning/20 text-warning text-[10px] px-2 py-0.5 rounded-full font-bold">Férias</span>}
            {(employee.status === 'leave' || employee.status === 'inactive') && <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Afastado</span>}

            <span className="text-gray-500 text-xs">•</span>
            <span className="text-gray-400 text-xs">Admissão: {employee.admission_date ? new Date(employee.admission_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-dark p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-1 text-gray-400">
              <Clock size={16} />
              <span className="text-xs">Horas (Mês)</span>
            </div>
            <p className="text-xl font-bold text-white">0h</p> {/* Placeholder for now */}
          </div>
          <div className="bg-surface-dark p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-1 text-gray-400">
              <MapPin size={16} />
              <span className="text-xs">Obras Ativas</span>
            </div>
            <p className="text-xl font-bold text-white">0</p> {/* Placeholder for now */}
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4">
          <h3 className="text-sm font-bold text-white">Informações de Contato</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-text-gold">
                <Phone size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Celular / WhatsApp</p>
                <p className="text-sm text-gray-200">{employee.contact || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-text-gold">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">E-mail</p>
                <p className="text-sm text-gray-200">{employee.email || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-text-gold">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Endereço</p>
                <p className="text-sm text-gray-200">{employee.address || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Certifications */}
        {employee.certifications && employee.certifications.length > 0 && (
          <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
            <h3 className="text-sm font-bold text-white mb-3">Certificações & Habilidades</h3>
            <div className="flex flex-wrap gap-2">
              {employee.certifications.map(cert => (
                <span key={cert} className="bg-[#4b3220] text-text-gold text-xs px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-1.5">
                  <Award size={12} />
                  {cert}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* History / Timeline (Static for now) */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Histórico Recente</h3>
          <div className="relative pl-4 border-l border-white/10 space-y-6">
            <div className="relative">
              <div className="absolute -left-[21px] top-1 size-3 rounded-full bg-primary ring-4 ring-brand-dark"></div>
              <p className="text-sm text-white font-medium">Cadastro atualizado</p>
              <p className="text-xs text-gray-500 mt-0.5">Hoje</p>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
};

// Missing import fix
import { UserX } from 'lucide-react';