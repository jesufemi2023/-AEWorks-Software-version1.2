import { Project } from '../types';

export const vaultService = {
    _token: null as string | null,
    setToken(token: string) {
        this._token = token;
    },
    getToken() {
        return this._token;
    },

    // Fetch all projects from the Master Vault (Server-side)
    async fetchAllProjects(): Promise<Project[]> {
        try {
            const response = await fetch('/api/vault/projects');
            if (!response.ok) throw new Error('Failed to fetch from Master Vault');
            return await response.json();
        } catch (error) {
            console.error('Vault Fetch Error:', error);
            throw error;
        }
    },

    // Save a project to the Master Vault (Server-side)
    async saveProject(project: Project): Promise<any> {
        try {
            const response = await fetch('/api/vault/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project }),
            });
            if (!response.ok) throw new Error('Failed to save to Master Vault');
            return await response.json();
        } catch (error) {
            console.error('Vault Save Error:', error);
            throw error;
        }
    },

    // Delete a project from the Master Vault (Server-side)
    async deleteProject(projectCode: string): Promise<void> {
        try {
            const response = await fetch(`/api/vault/delete/${projectCode}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete from Master Vault');
        } catch (error) {
            console.error('Vault Delete Error:', error);
            throw error;
        }
    },

    // Fetch Global Data (Clients, Materials, etc.)
    async fetchGlobalData(): Promise<any> {
        try {
            const response = await fetch('/api/vault/global');
            if (!response.ok) throw new Error('Failed to fetch global data');
            return await response.json();
        } catch (error) {
            console.error('Vault Global Fetch Error:', error);
            throw error;
        }
    },

    // Save Global Data
    async saveGlobalData(data: any): Promise<any> {
        try {
            const response = await fetch('/api/vault/global', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
            });
            if (!response.ok) throw new Error('Failed to save global data');
            return await response.json();
        } catch (error) {
            console.error('Vault Global Save Error:', error);
            throw error;
        }
    },

    // Fetch Feedback from Inbox
    async fetchInboxFeedback(): Promise<any[]> {
        try {
            const response = await fetch('/api/vault/feedback');
            if (!response.ok) throw new Error('Failed to fetch feedback');
            return await response.json();
        } catch (error) {
            console.error('Vault Feedback Fetch Error:', error);
            throw error;
        }
    },

    // Delete feedback file after ingestion
    async deleteInboxFeedback(fileId: string): Promise<void> {
        try {
            const response = await fetch(`/api/vault/feedback/${fileId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete feedback');
        } catch (error) {
            console.error('Vault Feedback Delete Error:', error);
            throw error;
        }
    }
};
