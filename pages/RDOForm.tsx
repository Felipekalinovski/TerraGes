import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, MapPin, Cloud, Users, Truck, AlertTriangle, Save, FileText, Loader2, ChevronDown, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { projectService, Project } from '../services/projectService';
import { rdoService } from '../services/rdoService';
import { machineService, Machine } from '../services/machineService';

export const RDOForm: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [machinesList, setMachinesList] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    project_id: '',
    date: new Date().toISOString().slice(0, 16),
    weather: 'sunny',
    team_size: 1,
    activities: '',
    machines: [] as string[],
    occurrences: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [projectsData, machinesData] = await Promise.all([
        projectService.getAll(),
        machineService.getAll()
      ]);
      setProjects(projectsData);
      setMachinesList(machinesData);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.project_id || !formData.activities) {
      alert('Por favor, selecione a obra e descreva as atividades.');
      return;
    }

    setSaving(true);
    try {
      // Garantir que a data esteja no formato correto para o Postgres
      const rdoToSave = {
        ...formData,
        date: new Date(formData.date).toISOString(),
        team_size: Number(formData.team_size)
      };

      console.log('Tentando salvar RDO:', rdoToSave);
      await rdoService.create(rdoToSave);

      alert('Diário de Obra salvo com sucesso!');
      navigate('/rdo');
    } catch (error: any) {
      console.error('Erro detalhado ao salvar RDO:', error);
      alert(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Layout.Header 
        title="Relatório Diário de Obra" 
        subTitle="Documentação técnica e controle de progresso"
        showBack
      />

      <Layout.Content>
        <div className="px-4 space-y-8 pb-40 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Main Info Card */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Identificação & Localização</h3>
            
            <div className="space-y-4">
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Projeto / Obra Ativa *</label>
                <div className="relative">
                  <select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    className="w-full h-14 pl-12 pr-10 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                  >
                    <option value="" disabled className="bg-surface-dark">
                      {loading ? 'Sincronizando obras...' : 'Selecione o projeto'}
                    </option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id} className="bg-surface-dark">{project.name}</option>
                    ))}
                  </select>
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>

              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Momento do Registro *</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-glass-sm"
                  />
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </div>

          {/* Logistics Card */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Logística & Clima</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Condição Climática</label>
                <div className="relative">
                  <select
                    value={formData.weather}
                    onChange={(e) => setFormData({ ...formData, weather: e.target.value })}
                    className="w-full h-14 pl-12 pr-10 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                  >
                    <option value="sunny" className="bg-surface-dark">Ensolarado</option>
                    <option value="cloudy" className="bg-surface-dark">Nublado</option>
                    <option value="rainy" className="bg-surface-dark">Chuvoso</option>
                    <option value="storm" className="bg-surface-dark">Tempestade</option>
                  </select>
                  <Cloud className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>

              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Efetivo de Campo</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.team_size}
                    onChange={(e) => setFormData({ ...formData, team_size: Number(e.target.value) })}
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-glass-sm"
                  />
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </div>

          {/* Activities Card */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-4">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Atividades Executadas *</h3>
            <textarea
              value={formData.activities}
              onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
              rows={4}
              className="w-full p-5 rounded-2xl bg-white/5 border border-white/5 text-white text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-gray-700 transition-all shadow-glass-sm resize-none"
              placeholder="Descreva o progresso físico da obra hoje..."
            ></textarea>
          </div>

          {/* Machinery Card */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Recursos Mecânicos</h3>
            
            <div className="space-y-4">
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Vincular Equipamento</label>
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !formData.machines.includes(val)) {
                        setFormData({ ...formData, machines: [...formData.machines, val] });
                      }
                    }}
                    className="w-full h-14 pl-12 pr-10 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                  >
                    <option value="" disabled className="bg-surface-dark">
                      {loading ? 'Carregando frota...' : 'Adicionar máquina ao RDO'}
                    </option>
                    {machinesList.map(machine => (
                      <option key={machine.id} value={machine.name} className="bg-surface-dark">{machine.name}</option>
                    ))}
                  </select>
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                    <Plus size={18} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {formData.machines.map(m => (
                  <span key={m} className="bg-primary/10 text-primary text-[10px] font-black px-4 py-2 rounded-2xl border border-primary/20 flex items-center gap-3 shadow-neon-sm animate-in zoom-in-50 duration-300 uppercase tracking-widest">
                    {m}
                    <button 
                      onClick={() => setFormData({ ...formData, machines: formData.machines.filter(x => x !== m) })}
                      className="size-5 rounded-full bg-primary/20 flex items-center justify-center hover:bg-negative/20 hover:text-negative transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {formData.machines.length === 0 && (
                  <p className="text-[10px] text-gray-600 italic px-1">Nenhum equipamento listado no relatório.</p>
                )}
              </div>
            </div>
          </div>

          {/* Occurrences Card */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-4">
            <div className="flex items-center gap-2 px-1">
               <AlertTriangle size={14} className="text-warning" />
               <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading">Ocorrências & Observações</h3>
            </div>
            <textarea
              value={formData.occurrences}
              onChange={(e) => setFormData({ ...formData, occurrences: e.target.value })}
              rows={3}
              className="w-full p-5 rounded-2xl bg-white/5 border border-white/5 text-white text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-gray-700 transition-all shadow-glass-sm resize-none"
              placeholder="Relate imprevistos, atrasos ou interferências climáticas..."
            ></textarea>
          </div>

          {/* Attachments */}
          <button className="w-full py-8 border-2 border-dashed border-white/5 bg-surface-dark/20 rounded-[40px] flex flex-col items-center justify-center gap-3 text-gray-500 font-black uppercase tracking-[0.2em] italic text-[10px] hover:border-primary/50 hover:text-primary transition-all group shadow-glass-sm">
            <div className="p-3 rounded-full bg-white/5 group-hover:bg-primary/10 transition-colors">
              <FileText size={24} />
            </div>
            Evidências Fotográficas
          </button>

        </div>
      </Layout.Content>

      {/* Action Persistence Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent z-40">
        <div className="max-w-md mx-auto space-y-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full h-14 bg-primary hover:brightness-110 active:scale-[0.98] text-black font-black uppercase tracking-[0.2em] italic text-xs rounded-[24px] transition-all shadow-neon-sm flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} strokeWidth={3} />}
            Finalizar Diário
          </button>
          
          <button
            onClick={() => navigate(-1)}
            disabled={saving}
            className="w-full h-12 bg-white/5 hover:bg-white/10 text-gray-400 font-bold uppercase tracking-widest text-[10px] rounded-[24px] transition-all"
          >
            Descartar Rascunho
          </button>
        </div>
      </div>
    </Layout>
  );
};
