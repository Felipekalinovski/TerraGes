import React from 'react';
import { Layout } from '../components/Layout';
import { Phone, Mail, Briefcase, Calendar, Award, Edit2, Clock, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const EmployeeDetails: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout title="Perfil do Colaborador" showBack hideNav={false}>
      <div className="relative">
        <div className="h-32 bg-gradient-to-r from-primary/20 to-brand-dark border-b border-white/10"></div>
        <div className="px-4 pb-4 -mt-12 flex justify-between items-end">
          <div className="size-24 rounded-full bg-gray-700 bg-cover bg-center border-4 border-brand-dark shadow-xl" 
               style={{ backgroundImage: `url('https://i.pravatar.cc/300?u=1')` }}>
          </div>
          <button 
            onClick={() => navigate('/employees/edit/1')}
            className="bg-surface-dark border border-white/10 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 mb-2"
          >
            <Edit2 size={14} /> Editar
          </button>
        </div>
      </div>

      <div className="px-4 space-y-6 pb-24">
        
        {/* Header Info */}
        <div>
          <h1 className="text-2xl font-bold text-white">Carlos Silva</h1>
          <p className="text-primary font-medium">Operador de Máquinas</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-positive/20 text-positive text-[10px] px-2 py-0.5 rounded-full font-bold">Ativo</span>
            <span className="text-gray-500 text-xs">•</span>
            <span className="text-gray-400 text-xs">Admissão: 12/03/2021</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-dark p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-1 text-gray-400">
              <Clock size={16} />
              <span className="text-xs">Horas (Mês)</span>
            </div>
            <p className="text-xl font-bold text-white">176h</p>
          </div>
          <div className="bg-surface-dark p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-1 text-gray-400">
              <MapPin size={16} />
              <span className="text-xs">Obras Ativas</span>
            </div>
            <p className="text-xl font-bold text-white">2</p>
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
                <p className="text-xs text-gray-500">Celular</p>
                <p className="text-sm text-gray-200">(11) 99999-1111</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-text-gold">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">E-mail</p>
                <p className="text-sm text-gray-200">carlos.silva@terrages.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Certifications */}
        <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
          <h3 className="text-sm font-bold text-white mb-3">Certificações & Habilidades</h3>
          <div className="flex flex-wrap gap-2">
            {['NR-12', 'CNH D', 'Escavadeira Hidráulica', 'Direção Defensiva'].map(cert => (
              <span key={cert} className="bg-[#4b3220] text-text-gold text-xs px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-1.5">
                <Award size={12} />
                {cert}
              </span>
            ))}
          </div>
        </div>

        {/* History / Timeline */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Histórico Recente</h3>
          <div className="relative pl-4 border-l border-white/10 space-y-6">
            <div className="relative">
              <div className="absolute -left-[21px] top-1 size-3 rounded-full bg-primary ring-4 ring-brand-dark"></div>
              <p className="text-sm text-white font-medium">Alocado na Obra: Condomínio Sol Nascente</p>
              <p className="text-xs text-gray-500 mt-0.5">15 de Julho, 2024</p>
            </div>
            <div className="relative">
              <div className="absolute -left-[21px] top-1 size-3 rounded-full bg-gray-600 ring-4 ring-brand-dark"></div>
              <p className="text-sm text-white font-medium">Renovação NR-12</p>
              <p className="text-xs text-gray-500 mt-0.5">20 de Junho, 2024</p>
            </div>
            <div className="relative">
              <div className="absolute -left-[21px] top-1 size-3 rounded-full bg-gray-600 ring-4 ring-brand-dark"></div>
              <p className="text-sm text-white font-medium">Férias (30 dias)</p>
              <p className="text-xs text-gray-500 mt-0.5">01 de Maio, 2024</p>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
};