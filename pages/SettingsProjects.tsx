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
        <Layout title="Gerenciar Obras" showBack hideNav>
            <div className="p-4 space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-gray-400 text-sm">Lista de obras ativas no sistema.</p>
                    <button
                        onClick={handleOpenAddModal}
                        className="bg-primary text-black p-2 rounded-lg hover:bg-primary-hover transition-colors"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {projects.map(project => (
                            <div key={project.id} className="bg-surface-dark p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                <button
                                    onClick={() => handleOpenEditModal(project)}
                                    className="flex items-center gap-4 text-left flex-1"
                                >
                                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                        <MapPin size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold">{project.name}</h3>
                                        <p className="text-gray-500 text-xs">{project.location || 'Sem localização'}</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => handleDeleteProject(project.id, project.name)}
                                    className="text-gray-500 hover:text-red-500 transition-colors p-2"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-surface-dark rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                        <div className="bg-[#4b3220] p-4 flex justify-between items-center">
                            <h3 className="text-white font-bold">{editingProject ? 'Editar Obra' : 'Nova Obra'}</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Nome da Obra</label>
                                <input
                                    type="text"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Ex: Edifício Central"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Localização</label>
                                <input
                                    type="text"
                                    value={newProject.location}
                                    onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Ex: Setor Sul"
                                />
                            </div>
                            <button
                                onClick={handleSaveProject}
                                disabled={saving || !newProject.name}
                                className="w-full h-12 bg-primary text-black font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                {editingProject ? 'Atualizar Obra' : 'Salvar Obra'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};
