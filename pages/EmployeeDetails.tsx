import React from 'react';
import { Layout } from '../components/Layout';
import { Phone, Mail, Clock, MapPin, Edit2, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const EmployeeDetails: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Layout title="Perfil" showBack hideNav={false}>
      <div className="h-32 bg-gradient-to-r from-primary/20 to-brand-dark border-b border-white/10"></div>
      <div className="px-4 -mt-12 flex justify-between items-end">
        <div className="size-24 rounded-full bg-gray-700 bg-cover bg-center border-4 border-brand-dark" style={{ backgroundImage: `url('https://i.pravatar.cc/300?u=1')` }}></div>
      </div>
      <div className="px-4 space-y-6 pb-24 mt-4">
        <h1 className="text-2xl font-bold text-white">Carlos Silva</h1>
        <p className="text-primary font-medium">Operador de Máquinas</p>
        <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4">
          <h3 className="text-sm font-bold text-white">Contato</h3>
          <p className="text-sm text-gray-200">(11) 99999-1111</p>
          <p className="text-sm text-gray-200">carlos.silva@terrages.com</p>
        </div>
      </div>
    </Layout>
  );
};
