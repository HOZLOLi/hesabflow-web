import { useState, useEffect } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
import { ImageService } from '../services/ImageService';

/**
 * useImageUrl — converts a file path (or legacy Base64 string) to a
 * displayable URL that works in both Tauri dev and production environments.
 *
 * For file paths: reads the file from disk and creates an in-memory Blob URL.
 * For Base64 data URLs: passes through unchanged (backward compat).
 * Returns null while loading.
 */
export function useImageUrl(pathOrBase64: string | undefined | null): string | null {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!pathOrBase64) {
            setUrl(null);
            return;
        }

        // Legacy Base64 — use directly
        if (ImageService.isBase64(pathOrBase64) || pathOrBase64.startsWith('http')) {
            setUrl(pathOrBase64);
            return;
        }

        // File path — read bytes and create Blob URL
        let blobUrl: string | null = null;
        let cancelled = false;

        readFile(pathOrBase64)
            .then((bytes) => {
                if (cancelled) return;
                // Detect MIME type from file extension
                const ext = pathOrBase64.split('.').pop()?.toLowerCase() || 'jpg';
                const mime =
                    ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
                const blob = new Blob([bytes], { type: mime });
                blobUrl = URL.createObjectURL(blob);
                setUrl(blobUrl);
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('⚠️ Failed to load image file:', pathOrBase64, err);
                    setUrl(null);
                }
            });

        return () => {
            cancelled = true;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [pathOrBase64]);

    return url;
}

/**
 * useImageUrls — same as useImageUrl but for an array of paths/Base64 strings.
 * Returns a parallel array of displayable URLs (null for items still loading).
 */
export function useImageUrls(paths: string[]): (string | null)[] {
    const [urls, setUrls] = useState<(string | null)[]>(() => paths.map(() => null));

    useEffect(() => {
        if (paths.length === 0) {
            setUrls([]);
            return;
        }

        let cancelled = false;
        const blobUrls: (string | null)[] = new Array(paths.length).fill(null);

        const load = async () => {
            const results = await Promise.all(
                paths.map(async (path, i) => {
                    if (!path) return null;

                    // Legacy Base64 or HTTP — use directly
                    if (ImageService.isBase64(path) || path.startsWith('http')) return path;

                    try {
                        const bytes = await readFile(path);
                        const ext = path.split('.').pop()?.toLowerCase() || 'jpg';
                        const mime =
                            ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
                        const blob = new Blob([bytes], { type: mime });
                        const blobUrl = URL.createObjectURL(blob);
                        blobUrls[i] = blobUrl;
                        return blobUrl;
                    } catch {
                        return null;
                    }
                })
            );

            if (!cancelled) setUrls(results);
        };

        load();

        return () => {
            cancelled = true;
            blobUrls.forEach((u) => u && URL.revokeObjectURL(u));
        };
    }, [paths.join(',')]);

    return urls;
}
