import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { driveService } from './server/driveService';

dotenv.config();

const app = express();

async function startServer() {
    const PORT = 3000;

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // --- MASTER VAULT API ROUTES ---

    // List all projects in the Master Vault
    app.get('/api/vault/projects', async (req, res) => {
        try {
            const projects = await driveService.listProjects();
            res.json(projects);
        } catch (error: any) {
            console.error('Vault List Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get Global Data (Clients, Materials, etc.)
    app.get('/api/vault/global', async (req, res) => {
        try {
            const data = await driveService.getGlobalData();
            res.json(data || {});
        } catch (error: any) {
            console.error('Vault Global Get Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Save Global Data
    app.post('/api/vault/global', async (req, res) => {
        try {
            const { data } = req.body;
            const result = await driveService.saveGlobalData(data);
            res.json(result);
        } catch (error: any) {
            console.error('Vault Global Save Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Save or Update a project in the Master Vault
    app.post('/api/vault/save', async (req, res) => {
        try {
            const { project } = req.body;
            if (!project || !project.projectCode) {
                return res.status(400).json({ error: 'Invalid project data' });
            }
            const result = await driveService.saveProject(project);
            res.json(result);
        } catch (error: any) {
            console.error('Vault Save Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete a project from the Master Vault
    app.delete('/api/vault/delete/:projectCode', async (req, res) => {
        try {
            const { projectCode } = req.params;
            await driveService.deleteProject(projectCode);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Vault Delete Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // --- FEEDBACK INBOX ROUTES ---

    // List all feedback in the inbox
    app.get('/api/vault/feedback', async (req, res) => {
        try {
            const feedback = await driveService.listFeedback();
            res.json(feedback);
        } catch (error: any) {
            console.error('Feedback List Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete feedback after ingestion
    app.delete('/api/vault/feedback/:fileId', async (req, res) => {
        try {
            const { fileId } = req.params;
            await driveService.deleteFeedback(fileId);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Feedback Delete Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // --- VITE MIDDLEWARE ---
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`AE-WORKS Server running on http://localhost:${PORT}`);
        console.log(`Master Vault: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'NOT CONFIGURED'}`);
    });
}

export default app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    startServer();
}
