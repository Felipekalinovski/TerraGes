import React from 'react';
import { Layout } from '../components/Layout';
import { User, Phone, Mail, MapPin, Briefcase, Calendar, Award, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const EmployeeForm: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout title="Novo Colaborador" showBack hideNav={false}>
      <div className="p-4 space-y-6 pb-24">
        
        {/* Photo Upload Placeholder */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="size-24 rounded-full bg-surface-dark border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 hover:border-primary hover:text-primary transition-colors cursor-pointer">
            <User size={32} />
          </div>
          <span className="text-sm text-primary font-medium">Adicionar Foto</span>
        </div>

        {/* Personal Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Dados Pessoais</h3>
          
          <div>
            <label className="block text-sm font-medium text-white mb-2">Nome Completo</label>
            <div className="relative">
              <input type="text" className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50" placeholder="Ex: Carlos Silva" />
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">CPF</label>
            <input type="text" className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50" placeholder="000.000.000-00" />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Data de Nascimento</label>
            <div className="relative">
              <input type="date" className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50" />
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Contato</h3>
          
          <div>
            <label className="block text-sm font-medium text-white mb-2">Telefone / WhatsApp</label>
            <div className="relative">
              <input type="tel" className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50" placeholder="(00) 00000-0000" />
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">E-mail</label>
            <div className="relative">
              <input type="email" className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50" placeholder="email@exemplo.com" />
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Endereço</label>
            <div className="relative">
              <input type="text" className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50" placeholder="Rua, Número, Bairro" />
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>
        </div>

        {/* Job Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Dados Contratuais</h3>
          
          <div>
            <label className="block text-sm font-medium text-white mb-2">Cargo / Função</label>
            <div className="relative">
              <select className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none">
                <option value="" disabled selected>Selecione o cargo</option>
                <option value="operator">Operador de Máquinas</option>
                <option value="engineer">Engenheiro</option>
                <option value="mechanic">Mecânico</option>
                <option value="driver">Motorista</option>
                <option value="assistant">Assistente</option>
              </select>
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Data de Admissão</label>
            <div className="relative">
              <input type="date" className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50" />
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Certificações (NRs)</label>
            <div className="flex flex-wrap gap-2">
              {['NR-10', 'NR-12', 'NR-35', 'CNH C', 'CNH D', 'CNH E'].map(cert => (
                <label key={cert} className="flex items-center gap-2 px-3 py-2 bg-surface-dark border border-white/10 rounded-lg cursor-pointer select-none hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/10 transition-colors">
                  <input type="checkbox" className="hidden" />
                  <span className="text-sm text-gray-300">{cert}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-brand-dark/95 backdrop-blur-sm border-t border-white/5 z-20">
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          <button 
            onClick={() => navigate('/employees')}
            className="w-full h-12 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <CheckCircle size={20} />
            Salvar Colaborador
          </button>
          <button 
            onClick={() => navigate(-1)}
            className="w-full h-12 bg-transparent hover:bg-white/5 text-primary font-bold rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Layout>
  );
};