import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Plus, MapPin, Trash2, Loader2, Save, X } from 'lucide-react';
import { projectService, Project } from '../services/projectService';

export const SettingsProjects: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [newProject, setNewProject] = useState({ name: '', location: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const data = await projectService.getAll();
            setProjects(data);
        } catch (error) {
            console.error('Erro ao carregar obras:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setEditingProject(null);
        setNewProject({ name: '', location: '' });
        setShowAddModal(true);
    };

    const handleOpenEditModal = (project: Project) => {
        setEditingProject(project);
        setNewProject({ name: project.name, location: project.location || '' });
        setShowAddModal(true);
    };

    const handleSaveProject = async () => {
        if (!newProject.name) return;
        setSaving(true);
        try {
            if (editingProject) {
                await projectService.update(editingProject.id, newProject);
            } else {
                await projectService.create(newProject);
            }
            setNewProject({ name: '', location: '' });
            setShowAddModal(false);
            setEditingProject(null);
            fetchProjects();
        } catch (error) {
            console.error('Erro ao salvar obra:', error);
            alert('Erro ao salvar obra. Tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProject = async (id: string, name: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir a obra "${name}"?`)) return;

        try {
            await projectService.delete(id);
            fetchProjects();
        } catch (error) {
            console.error('Erro ao excluir obra:', error);
            alert('Erro ao excluir obra. Verifique se existem ordens de serviço vinculadas a ela.');
        }
    };

    return (
        <Layout>
            <Layout.Header 
                title="Gerenciar Obras" 
                subTitle="Controle os canteiros de obra ativos no sistema"
                showBack
            />

            <Layout.Content>
                <div className="p-4 space-y-4 animate-in fade-in duration-700">
                    <div className="flex justify-between items-center mb-2 px-2">
                        <div className="flex flex-col">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Master List</p>
                            <p className="text-[9px] font-medium text-gray-500 uppercase tracking-tight">Obras registradas</p>
                        </div>
                        <button
                            onClick={handleOpenAddModal}
                            className="size-12 bg-primary text-black rounded-2xl flex items-center justify-center shadow-neon hover:bg-primary-hover transition-all active:scale-90"
                        >
                            <Plus size={24} strokeWidth={2.5} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-primary" size={40} />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {projects.map(project => (
                                <div 
                                    key={project.id} 
                                    className="group relative bg-surface-dark/40 backdrop-blur-md p-5 rounded-[28px] border border-white/5 flex items-center justify-between hover:border-primary/20 transition-all duration-300 shadow-glass"
                                >
                                    <button
                                        onClick={() => handleOpenEditModal(project)}
                                        className="flex items-center gap-5 text-left flex-1"
                                    >
                                        <div className="size-14 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 border border-white/5">
                                            <MapPin size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold group-hover:text-primary transition-colors tracking-tight text-lg">{project.name}</h3>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <div className="size-1 bg-gray-600 rounded-full" />
                                                <p className="text-gray-500 text-[10px] font-medium uppercase tracking-widest">{project.location || 'Sem localização'}</p>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteProject(project.id, project.name)}
                                        className="size-10 rounded-xl bg-red-500/5 text-red-500/40 hover:bg-red-500/10 hover:text-red-500 transition-all flex items-center justify-center"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modal Adicionar/Editar */}
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-full max-w-sm bg-surface-dark/90 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden glass-card">
                            <div className="px-8 pt-8 pb-4 flex justify-between items-center">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-white tracking-tight">{editingProject ? 'Ajustar Obra' : 'Nova Obra'}</h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Preencha os dados</p>
                                </div>
                                <button 
                                    onClick={() => setShowAddModal(false)} 
                                    className="size-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Nome da Obra</label>
                                    <input
                                        type="text"
                                        value={newProject.name}
                                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                        className="w-full h-14 px-6 rounded-3xl bg-white/5 border border-white/5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all"
                                        placeholder="Ex: Edifício Central"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Localização</label>
                                    <input
                                        type="text"
                                        value={newProject.location}
                                        onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                                        className="w-full h-14 px-6 rounded-3xl bg-white/5 border border-white/5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all"
                                        placeholder="Ex: Setor Sul"
                                    />
                                </div>

                                <button
                                    onClick={handleSaveProject}
                                    disabled={saving || !newProject.name}
                                    className="w-full h-16 bg-primary text-black font-black uppercase tracking-widest text-[11px] rounded-3xl flex items-center justify-center gap-3 shadow-neon disabled:opacity-50 transition-all active:scale-[0.98]"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} strokeWidth={2.5} />}
                                    {editingProject ? 'Atualizar Registro' : 'Efetivar Cadastro'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Layout.Content>
        </Layout>
    );
};
