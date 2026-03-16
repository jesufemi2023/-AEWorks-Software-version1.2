import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// The Service Account needs these scopes to manage files
const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.metadata.readonly'];

class DriveService {
    private drive: any;

    constructor() {
        this.initDrive();
    }

    private initDrive() {
        const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!clientEmail || !privateKey) {
            console.warn('Google Drive Service Account credentials not fully configured.');
            return;
        }

        const auth = new google.auth.JWT(
            clientEmail,
            undefined,
            privateKey,
            SCOPES
        );

        this.drive = google.drive({ version: 'v3', auth });
    }

    private getFolderId() {
        return process.env.GOOGLE_DRIVE_FOLDER_ID;
    }

    async listProjects() {
        if (!this.drive) throw new Error('Drive not initialized');
        const folderId = this.getFolderId();
        if (!folderId) throw new Error('Master Folder ID not configured');

        const response = await this.drive.files.list({
            q: `'${folderId}' in parents and trashed = false and mimeType = 'application/json'`,
            fields: 'files(id, name, modifiedTime)',
        });

        const files = response.data.files || [];
        const projects = [];

        for (const file of files) {
            try {
                const content = await this.drive.files.get({
                    fileId: file.id,
                    alt: 'media',
                });
                projects.push(content.data);
            } catch (e) {
                console.error(`Error reading file ${file.name}:`, e);
            }
        }

        return projects;
    }

    async saveProject(project: any) {
        if (!this.drive) throw new Error('Drive not initialized');
        const folderId = this.getFolderId();
        if (!folderId) throw new Error('Master Folder ID not configured');

        const fileName = `${project.projectCode}.json`;
        return this.uploadJson(fileName, project, folderId);
    }

    async saveGlobalData(data: any) {
        if (!this.drive) throw new Error('Drive not initialized');
        const folderId = this.getFolderId();
        if (!folderId) throw new Error('Master Folder ID not configured');

        return this.uploadJson('GLOBAL_DATA.json', data, folderId);
    }

    async getGlobalData() {
        if (!this.drive) throw new Error('Drive not initialized');
        const folderId = this.getFolderId();
        if (!folderId) throw new Error('Master Folder ID not configured');

        const existing = await this.drive.files.list({
            q: `'${folderId}' in parents and name = 'GLOBAL_DATA.json' and trashed = false`,
            fields: 'files(id)',
        });

        if (existing.data.files.length === 0) return null;

        const response = await this.drive.files.get({
            fileId: existing.data.files[0].id,
            alt: 'media',
        });

        return response.data;
    }

    private async uploadJson(fileName: string, data: any, folderId: string) {
        const existing = await this.drive.files.list({
            q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
            fields: 'files(id)',
        });

        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };

        const media = {
            mimeType: 'application/json',
            body: JSON.stringify(data, null, 2),
        };

        if (existing.data.files.length > 0) {
            const fileId = existing.data.files[0].id;
            await this.drive.files.update({
                fileId: fileId,
                media: media,
            });
            return { success: true, action: 'updated', fileId };
        } else {
            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id',
            });
            return { success: true, action: 'created', fileId: response.data.id };
        }
    }

    async deleteProject(projectCode: string) {
        if (!this.drive) throw new Error('Drive not initialized');
        const folderId = this.getFolderId();
        const fileName = `${projectCode}.json`;

        const existing = await this.drive.files.list({
            q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
            fields: 'files(id)',
        });

        if (existing.data.files.length > 0) {
            await this.drive.files.delete({
                fileId: existing.data.files[0].id,
            });
        }
    }

    async listFeedback() {
        if (!this.drive) throw new Error('Drive not initialized');
        const feedbackFolderId = process.env.GOOGLE_DRIVE_FEEDBACK_FOLDER_ID;
        if (!feedbackFolderId) return [];

        const response = await this.drive.files.list({
            q: `'${feedbackFolderId}' in parents and trashed = false and mimeType = 'application/json'`,
            fields: 'files(id, name)',
        });

        const files = response.data.files || [];
        const feedbacks = [];

        for (const file of files) {
            try {
                const content = await this.drive.files.get({
                    fileId: file.id,
                    alt: 'media',
                });
                feedbacks.push({
                    ...content.data,
                    fileId: file.id
                });
            } catch (e) {
                console.error(`Error reading feedback file ${file.name}:`, e);
            }
        }

        return feedbacks;
    }

    async deleteFeedback(fileId: string) {
        if (!this.drive) throw new Error('Drive not initialized');
        await this.drive.files.delete({ fileId });
    }
}

export const driveService = new DriveService();
