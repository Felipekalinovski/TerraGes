import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Plus, MapPin, Trash2, Loader2, Save, X } from 'lucide-react';
import { projectService, Project } from '../services/projectService';

export const SettingsProjects: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
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

    const handleAddProject = async () => {
        if (!newProject.name) return;
        setSaving(true);
        try {
            await projectService.create(newProject);
            setNewProject({ name: '', location: '' });
            setShowAddModal(false);
            fetchProjects();
        } catch (error) {
            console.error('Erro ao criar obra:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout title="Gerenciar Obras" showBack hideNav>
            <div className="p-4 space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-gray-400 text-sm">Lista de obras ativas no sistema.</p>
                    <button
                        onClick={() => setShowAddModal(true)}
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
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                        <MapPin size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold">{project.name}</h3>
                                        <p className="text-gray-500 text-xs">{project.location || 'Sem localização'}</p>
                                    </div>
                                </div>
                                <button className="text-gray-500 hover:text-red-500 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Adicionar */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-surface-dark rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                        <div className="bg-[#4b3220] p-4 flex justify-between items-center">
                            <h3 className="text-white font-bold">Nova Obra</h3>
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
                                onClick={handleAddProject}
                                disabled={saving || !newProject.name}
                                className="w-full h-12 bg-primary text-black font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                Salvar Obra
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};
