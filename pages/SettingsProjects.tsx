
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Plus, MapPin, Loader2, Save } from 'lucide-react';
import { projectService, Project } from '../services/projectService';

export const SettingsProjects: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchProjects(); }, []);

    const fetchProjects = async () => {
        const data = await projectService.getAll();
        setProjects(data);
        setLoading(false);
    };

    return (
        <Layout title="Gerenciar Obras" showBack hideNav>
            <div className="p-4 space-y-4">
                {projects.map(p => (
                    <div key={p.id} className="bg-surface-dark p-4 rounded-xl flex items-center gap-3">
                        <MapPin className="text-primary" />
                        <div><h3 className="font-bold">{p.name}</h3><p className="text-xs text-gray-500">{p.location}</p></div>
                    </div>
                ))}
            </div>
        </Layout>
    );
};
