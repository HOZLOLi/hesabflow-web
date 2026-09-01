import { BaseDirectory, mkdir, writeFile, remove, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';

export class ImageService {
    /**
     * Saves a base64 string into the local appData folder.
     * Returns the absolute path to the saved file.
     */
    static async saveImage(base64DataUrl: string, receiptId: string, category: string): Promise<string> {
        try {
            // Create photos directory structure
            const baseDirRel = `hesabflow_photos/${receiptId}/${category}`;
            const hasBaseDir = await exists(baseDirRel, { baseDir: BaseDirectory.AppData });
            if (!hasBaseDir) {
                await mkdir(baseDirRel, { baseDir: BaseDirectory.AppData, recursive: true });
            }

            // Extract raw base64 data
            const base64Data = base64DataUrl.split(',')[1] || base64DataUrl;
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const filePathRel = `${baseDirRel}/${fileName}`;

            await writeFile(filePathRel, bytes, { baseDir: BaseDirectory.AppData });

            // Return the full absolute path
            const appDataPath = await appDataDir();
            return await join(appDataPath, filePathRel);
        } catch (error) {
            console.error('Failed to save image:', error);
            throw error;
        }
    }

    /**
     * Deletes a file given its absolute path.
     */
    static async deleteImage(absolutePath: string): Promise<void> {
        try {
            if (absolutePath && absolutePath.trim() !== '') {
                const fileExists = await exists(absolutePath);
                if (fileExists) {
                    await remove(absolutePath);
                }
            }
        } catch (error) {
            console.error('Failed to delete image:', absolutePath, error);
        }
    }

    /**
     * Converts a file path to a Tauri safe URL for rendering.
     * If it's still a base64 string, it returns it directly.
     */
    static getDisplayUrl(filePathOrBase64: string): string {
        if (!filePathOrBase64) return '';
        if (filePathOrBase64.startsWith('data:image')) return filePathOrBase64;
        return convertFileSrc(filePathOrBase64);
    }

    static isBase64(str: string): boolean {
        if (!str) return false;
        return str.startsWith('data:image');
    }
}
