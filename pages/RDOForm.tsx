import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, MapPin, Cloud, Users, Truck, AlertTriangle, Save, FileText, Loader2 } from 'lucide-react';
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
    <Layout title="Novo Diário de Obra" showBack hideNav={false}>
      <div className="p-4 space-y-6 pb-24">

        {/* Header Data */}
        <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Data do Relatório</label>
            <div className="relative">
              <input
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
              />
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Obra / Projeto</label>
            <div className="relative">
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
              >
                <option value="" disabled>
                  {loading ? 'Carregando obras...' : 'Selecione a obra'}
                </option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              {loading ? (
                <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold animate-spin" size={20} />
              ) : (
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
              )}
            </div>
          </div>
        </div>

        {/* Environmental & Team */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Clima</label>
            <div className="relative">
              <select
                value={formData.weather}
                onChange={(e) => setFormData({ ...formData, weather: e.target.value })}
                className="w-full h-12 pl-10 pr-2 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none text-sm"
              >
                <option value="sunny">Ensolarado</option>
                <option value="cloudy">Nublado</option>
                <option value="rainy">Chuvoso</option>
              </select>
              <Cloud className="absolute left-3 top-1/2 -translate-y-1/2 text-text-gold" size={18} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">Efetivo</label>
            <div className="relative">
              <input
                type="number"
                value={formData.team_size}
                onChange={(e) => setFormData({ ...formData, team_size: Number(e.target.value) })}
                placeholder="Qtd."
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none text-sm"
              />
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-text-gold" size={18} />
            </div>
          </div>
        </div>

        {/* Activities */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Atividades Executadas</label>
          <textarea
            value={formData.activities}
            onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
            className="w-full h-32 p-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50 resize-none"
            placeholder="Descreva as atividades realizadas hoje..."
          ></textarea>
        </div>

        {/* Resources */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Maquinário Utilizado</label>
          <div className="relative">
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val && !formData.machines.includes(val)) {
                  setFormData({ ...formData, machines: [...formData.machines, val] });
                }
              }}
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
            >
              <option value="" disabled>
                {loading ? 'Carregando máquinas...' : 'Adicionar máquinas'}
              </option>
              {machinesList.map(machine => (
                <option key={machine.id} value={machine.name}>{machine.name}</option>
              ))}
            </select>
            <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.machines.map(m => (
              <span key={m} className="bg-primary/20 text-primary text-xs px-3 py-1 rounded-full flex items-center gap-2">
                {m}
                <button onClick={() => setFormData({ ...formData, machines: formData.machines.filter(x => x !== m) })}>×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Occurrences */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Ocorrências / Observações</label>
          <div className="relative">
            <textarea
              value={formData.occurrences}
              onChange={(e) => setFormData({ ...formData, occurrences: e.target.value })}
              className="w-full h-24 p-4 pl-12 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50 resize-none"
              placeholder="Houve algum imprevisto?"
            ></textarea>
            <AlertTriangle className="absolute left-4 top-6 text-text-gold" size={20} />
          </div>
        </div>

        {/* Attachments */}
        <button className="w-full h-14 border-2 border-dashed border-[#4b3220] bg-surface-dark rounded-xl flex items-center justify-center gap-2 text-text-gold font-bold hover:border-primary hover:text-primary transition-colors">
          <FileText size={20} />
          Anexar Fotos do Dia
        </button>

      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-brand-dark/95 backdrop-blur-sm border-t border-white/5 z-20">
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full h-12 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Salvar RDO
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
