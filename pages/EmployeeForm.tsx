import React from 'react';
import { Layout } from '../components/Layout';
import { User, Phone, Mail, MapPin, Briefcase, Calendar, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const EmployeeForm: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Layout title="Novo Colaborador" showBack hideNav={false}>
      <div className="p-4 space-y-6 pb-24">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="size-24 rounded-full bg-surface-dark border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500">
            <User size={32} />
          </div>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-white mb-2">Nome Completo</label>
          <input type="text" className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none" />
          <label className="block text-sm font-medium text-white mb-2">Cargo</label>
          <select className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none">
            <option value="operator">Operador</option>
            <option value="engineer">Engenheiro</option>
          </select>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-brand-dark/95 backdrop-blur-sm border-t border-white/5 z-20">
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          <button onClick={() => navigate('/employees')} className="w-full h-12 bg-primary text-black font-bold rounded-xl flex items-center justify-center gap-2">
            <CheckCircle size={20} /> Salvar
          </button>
        </div>
      </div>
    </Layout>
  );
};
