
import { vaultService } from './vaultService';

export const generateId = () => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {}
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

export const getData = <T,>(key: string): T[] => {
    try {
        const data = localStorage.getItem(key);
        if (!data) return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
};

export const saveData = <T,>(key: string, data: T[]): boolean => {
    try {
        const timestamp = new Date().toISOString();
        const dataWithMeta = data.map(item => {
            if (item && typeof item === 'object') {
                const typed = item as any;
                let stableId = typed.id;
                if (key === 'users') stableId = typed.email || typed.username || typed.id;
                if (key === 'projects') stableId = typed.projectCode || typed.id;
                if (key === 'clients') stableId = typed.name || typed.id;

                return {
                    ...item,
                    id: stableId || generateId(),
                    updatedAt: typed.updatedAt || timestamp
                };
            }
            return item;
        });
        localStorage.setItem(key, JSON.stringify(dataWithMeta));
        window.dispatchEvent(new CustomEvent('aeworks_db_update', { detail: { key } }));
        return true;
    } catch (error) {
        return false;
    }
};

export const getSystemLogo = (): string | null => localStorage.getItem('system_logo');
export const saveSystemLogo = (base64Data: string | null): void => {
    if (base64Data) localStorage.setItem('system_logo', base64Data);
    else localStorage.removeItem('system_logo');
};

export interface SystemMeta {
    id: string;
    versionLabel: string;
    lastCloudSync?: string;
    syncApiKey: string; 
    autoSync: boolean;
    backupLocation?: string;
    driveFileId?: string;
    driveAccessToken?: string;
    googleClientId?: string; 
    driveFileUrl?: string;
    activeCollaborators?: string[];
    masterCorporateEmail?: string;
}

const GLOBAL_ENV_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
const HARDCODED_FALLBACK_ID = '674092109435-96p21r75k1jgr7t1f0l4eohf5c49k23t.apps.googleusercontent.com';
const MASTER_CLIENT_ID = GLOBAL_ENV_CLIENT_ID || HARDCODED_FALLBACK_ID;

export const getSystemMeta = (): SystemMeta => {
    const raw = localStorage.getItem('system_meta');
    const urlParams = new URLSearchParams(window.location.search);
    const urlClientId = urlParams.get('cid');
    const urlMasterEmail = urlParams.get('master');

    const defaultMeta: SystemMeta = { 
        id: 'meta', 
        versionLabel: 'v4.6 Multi-Dev Sync', 
        syncApiKey: '',
        autoSync: true,
        backupLocation: 'Google_Drive_AEWorks',
        googleClientId: MASTER_CLIENT_ID
    };
    
    let meta = defaultMeta;
    if (raw) {
        try {
            const data = JSON.parse(raw);
            meta = { ...defaultMeta, ...(Array.isArray(data) ? data[0] : data) };
        } catch {}
    }

    if (urlClientId || urlMasterEmail) {
        let updated = false;
        if (urlClientId && meta.googleClientId !== urlClientId) {
            meta.googleClientId = urlClientId;
            updated = true;
        }
        if (urlMasterEmail && meta.masterCorporateEmail !== urlMasterEmail) {
            meta.masterCorporateEmail = urlMasterEmail;
            updated = true;
        }
        if (updated) {
            localStorage.setItem('system_meta', JSON.stringify([meta]));
        }
    }

    return meta;
};

export const updateSystemMeta = (meta: Partial<SystemMeta>): void => {
    const current = getSystemMeta();
    localStorage.setItem('system_meta', JSON.stringify([{ ...current, ...meta }]));
};

export const DB_KEYS = ['clients', 'contacts', 'centres', 'framingMaterials', 'finishMaterials', 'projects', 'users', 'payrollRuns', 'defaultCostingVariables', 'productionLogs', 'locationExpenses', 'unassignedFeedback'];

export const syncWithCloud = async (onNewFeedback?: (projectCode: string) => void): Promise<{success: boolean, message: string}> => {
    try {
        // 1. Fetch Global Data (Clients, Materials, etc.)
        const globalData = await vaultService.fetchGlobalData();
        if (globalData) {
            DB_KEYS.forEach(key => {
                if (key !== 'projects' && globalData[key]) {
                    const local = getData<any>(key);
                    const remote = globalData[key];
                    const merged = mergeDatasets(key, local, remote);
                    localStorage.setItem(key, JSON.stringify(merged));
                }
            });
        }

        // 2. Fetch all Projects
        const remoteProjects = await vaultService.fetchAllProjects();
        const localProjects = getData<any>('projects');
        const mergedProjects = mergeDatasets('projects', localProjects, remoteProjects);
        localStorage.setItem('projects', JSON.stringify(mergedProjects));

        updateSystemMeta({ lastCloudSync: new Date().toISOString() });
        
        // 3. Sync Inbox Feedback
        await syncInboxFeedback(onNewFeedback);

        window.dispatchEvent(new CustomEvent('aeworks_db_update', { detail: { key: 'all' } }));
        return { success: true, message: "Master Vault Sync Success." };
    } catch (err: any) {
        console.error('Master Vault Sync Error:', err);
        return { success: false, message: "Vault Sync Failed." };
    }
};

export const pushToCloud = async (): Promise<{success: boolean, message: string}> => {
    try {
        // 1. Push Global Data
        const globalData: any = {};
        DB_KEYS.forEach(key => {
            if (key !== 'projects') globalData[key] = getData(key);
        });
        await vaultService.saveGlobalData(globalData);

        // 2. Push all Projects (one by one for consistency)
        const projects = getData<any>('projects');
        for (const project of projects) {
            await vaultService.saveProject(project);
        }

        updateSystemMeta({ lastCloudSync: new Date().toISOString() });
        return { success: true, message: "Master Vault Push Success." };
    } catch (err: any) {
        console.error('Master Vault Push Error:', err);
        return { success: false, message: "Vault Push Failed." };
    }
};

export const syncInboxFeedback = async (onNewFeedback?: (projectCode: string) => void): Promise<{success: boolean, count: number}> => {
    try {
        const feedbackFiles = await vaultService.fetchInboxFeedback();
        if (!feedbackFiles || feedbackFiles.length === 0) return { success: true, count: 0 };

        let count = 0;
        const projects = getData<any>('projects');

        for (const file of feedbackFiles) {
            const { projectCode, feedback, fileId } = file;
            const projectIndex = projects.findIndex(p => p.projectCode === projectCode);

            if (projectIndex !== -1) {
                // Update project tracking data
                projects[projectIndex] = {
                    ...projects[projectIndex],
                    trackingData: {
                        ...projects[projectIndex].trackingData,
                        feedbackStatus: 'received',
                        customerFeedback: feedback,
                        receivedAt: new Date().toISOString()
                    }
                };
                count++;
                if (onNewFeedback) onNewFeedback(projectCode);
            } else {
                // Store in unassigned feedback if project not found
                const unassigned = getData<any>('unassignedFeedback');
                unassigned.push({ ...file, receivedAt: new Date().toISOString() });
                saveData('unassignedFeedback', unassigned);
            }

            // Delete from cloud inbox after processing
            await vaultService.deleteInboxFeedback(fileId);
        }

        if (count > 0) {
            saveData('projects', projects);
        }

        return { success: true, count };
    } catch (err) {
        console.error('Inbox Sync Error:', err);
        return { success: false, count: 0 };
    }
};

const mergeDatasets = (dbKey: string, local: any[], remote: any[]) => {
    const map = new Map();
    const getStableId = (item: any) => {
        if (dbKey === 'users') return item.email || item.username || item.id;
        if (dbKey === 'projects') return item.projectCode || item.id;
        if (dbKey === 'clients') return item.name || item.id;
        return item.id;
    };
    remote.forEach(i => map.set(getStableId(i), i));
    local.forEach(i => {
        const id = getStableId(i);
        const rem = map.get(id);
        if (!rem || new Date(i.updatedAt || 0) > new Date(rem.updatedAt || 0)) map.set(id, i);
    });
    return Array.from(map.values());
};
