import { ImageService } from './ImageService';
import { DatabaseService } from './DatabaseService';
import type { RepairReceipt } from '../types';

/**
 * MigrationService
 *
 * One-time migration utility that converts Base64 image data URLs
 * (the old storage format) to on-disk file paths (the new format).
 *
 * Called once on app startup from loadAllData.
 * Safe to call multiple times — it is idempotent.
 */
export class MigrationService {
    private static readonly MIGRATION_KEY = 'hesabflow_img_migration_v1_done';

    /** Returns true if the migration has already been completed. */
    static isAlreadyMigrated(): boolean {
        return localStorage.getItem(this.MIGRATION_KEY) === 'true';
    }

    /**
     * Scan all repair receipts and convert any images that are still
     * stored as Base64 data URLs into proper files on disk.
     * After conversion the new file paths are saved back to the database.
     */
    static async migrateExistingImages(receipts: RepairReceipt[]): Promise<void> {
        if (this.isAlreadyMigrated()) return;

        const base64Receipts = receipts.filter((r) => {
            const all = [
                ...(r.imagesReceive || []),
                ...(r.imagesRepaired || []),
                ...(r.imagesDelivery || []),
            ];
            return all.some((img) => ImageService.isBase64(img));
        });

        if (base64Receipts.length === 0) {
            console.log('✅ No Base64 images to migrate.');
            localStorage.setItem(this.MIGRATION_KEY, 'true');
            return;
        }

        console.log(`🔄 Migrating images for ${base64Receipts.length} receipt(s)...`);

        for (const receipt of base64Receipts) {
            try {
                const imagesReceive = await this.convertArray(
                    receipt.imagesReceive || [],
                    receipt.id,
                    'receive'
                );
                const imagesRepaired = await this.convertArray(
                    receipt.imagesRepaired || [],
                    receipt.id,
                    'repaired'
                );
                const imagesDelivery = await this.convertArray(
                    receipt.imagesDelivery || [],
                    receipt.id,
                    'delivery'
                );

                const updated: RepairReceipt = {
                    ...receipt,
                    imagesReceive,
                    imagesRepaired,
                    imagesDelivery,
                    updatedAt: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
                };

                await DatabaseService.updateRepairReceipt(updated);
                console.log(`✅ Migrated receipt #${receipt.receiptNumber}`);
            } catch (err) {
                console.error(`❌ Failed to migrate receipt #${receipt.receiptNumber}:`, err);
                // Continue with other receipts even if one fails
            }
        }

        localStorage.setItem(this.MIGRATION_KEY, 'true');
        console.log('✅ Image migration complete.');
    }

    /** Convert an array of image strings — Base64 ones are written to disk,
     *  path-based ones are passed through unchanged. */
    private static async convertArray(
        images: string[],
        receiptId: string,
        category: 'receive' | 'repaired' | 'delivery'
    ): Promise<string[]> {
        const results: string[] = [];
        for (const img of images) {
            if (ImageService.isBase64(img)) {
                const path = await ImageService.saveImage(img, receiptId, category);
                results.push(path);
            } else {
                results.push(img); // already a path
            }
        }
        return results;
    }
}
