
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Phone, Mail, Briefcase, Calendar, Award, Edit2, Clock, MapPin, Loader2, ArrowLeft, UserX, User } from 'lucide-react';
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
    <Layout>
      <Layout.Header 
        title="Perfil do Colaborador" 
        subTitle={employee.role}
        showBack
        actions={
          <button
            onClick={() => navigate(`/employees/edit/${employee.id}`)}
            className="bg-surface-dark border border-white/10 text-white p-2.5 rounded-xl flex items-center gap-2 hover:bg-white/5 transition-all shadow-glass"
          >
            <Edit2 size={18} strokeWidth={2.5} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Editar Perfil</span>
          </button>
        }
      />

      <Layout.Content>
        {/* Profile Hero */}
        <div className="relative mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="h-40 bg-gradient-to-br from-primary/30 via-surface-dark to-surface-dark border-b border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,229,153,0.1),transparent)]"></div>
          </div>
          
          <div className="px-6 -mt-16 flex items-end gap-6 relative z-10">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-[32px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <div 
                className="size-32 rounded-[32px] bg-surface-dark border-4 border-surface-dark relative z-10 shadow-glass flex items-center justify-center overflow-hidden"
              >
                {employee.image_url ? (
                  <img src={employee.image_url} alt={employee.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-gray-600" />
                )}
              </div>
            </div>
            
            <div className="pb-2">
              <h1 className="text-3xl font-heading font-black text-white italic tracking-tighter uppercase leading-none mb-2 drop-shadow-lg">
                {employee.name}
              </h1>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                  employee.status === 'active' ? 'bg-positive/10 border-positive/30 text-positive' : 
                  employee.status === 'vacation' ? 'bg-warning/10 border-warning/30 text-warning' : 'bg-negative/10 border-negative/30 text-negative'
                } text-[10px] font-black uppercase tracking-widest shadow-neon-sm`}>
                  <div className={`size-1.5 rounded-full ${
                    employee.status === 'active' ? 'bg-positive' : 
                    employee.status === 'vacation' ? 'bg-warning' : 'bg-negative'
                  }`}></div>
                  {employee.status === 'active' ? 'Ativo' : 
                   employee.status === 'vacation' ? 'Férias' : 'Off'}
                </div>
                <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">
                  Desde {employee.admission_date ? new Date(employee.admission_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-dark/40 backdrop-blur-md p-5 rounded-[32px] border border-white/5 shadow-glass group hover:border-primary/20 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Clock size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-primary transition-colors">Horas (Mês)</span>
              </div>
              <p className="text-2xl font-black text-white italic font-heading">168h</p>
            </div>
            
            <div className="bg-surface-dark/40 backdrop-blur-md p-5 rounded-[32px] border border-white/5 shadow-glass group hover:border-primary/20 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <MapPin size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-primary transition-colors">Projetos</span>
              </div>
              <p className="text-2xl font-black text-white italic font-heading">03</p>
            </div>
          </div>

          {/* Contact Cards - Compact List */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[40px] border border-white/5 shadow-glass space-y-5">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Comunicação & Localização</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 group">
                <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-all shadow-glass-sm border border-white/5">
                  <Phone size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">Celular / WhatsApp</p>
                  <p className="text-sm font-bold text-gray-200 tracking-tight group-hover:text-white transition-colors">{employee.contact || 'Não informado'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 group">
                <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-all shadow-glass-sm border border-white/5">
                  <Mail size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">E-mail Corporativo</p>
                  <p className="text-sm font-bold text-gray-200 tracking-tight group-hover:text-white transition-colors lowercase">{employee.email || 'Não informado'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 group">
                <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-all shadow-glass-sm border border-white/5">
                  <MapPin size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">Residência Atual</p>
                  <p className="text-sm font-bold text-gray-200 tracking-tight group-hover:text-white transition-colors">{employee.address || 'Não informado'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Certifications Badge Cloud */}
          {employee.certifications && employee.certifications.length > 0 && (
            <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[40px] border border-white/5 shadow-glass">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1 mb-5">Qualificações Técnicas</h3>
              <div className="flex flex-wrap gap-2.5">
                {employee.certifications.map(cert => (
                  <span key={cert} className="bg-primary/5 text-primary text-[10px] font-black px-4 py-2 rounded-2xl border border-primary/20 flex items-center gap-2 shadow-neon-sm hover:bg-primary/10 transition-colors uppercase tracking-widest">
                    <Award size={14} strokeWidth={3} />
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="px-1">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading mb-6">Linha do Tempo</h3>
            <div className="relative pl-6 border-l-2 border-white/5 space-y-8">
              <div className="relative">
                <div className="absolute -left-[31px] top-1 size-4 rounded-full bg-primary shadow-neon ring-4 ring-surface-dark border border-black/20"></div>
                <p className="text-xs font-black text-white uppercase tracking-widest italic mb-1">Atualização Cadastral</p>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                   <p className="text-[10px] font-bold text-gray-400">Dados biográficos e certificações revisados para auditoria de segurança.</p>
                </div>
                <p className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em] mt-2">Hoje • 08:30</p>
              </div>
            </div>
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};