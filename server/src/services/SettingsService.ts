import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../db.js';

const UPLOADS_DIR = path.join(process.cwd(), 'server', 'uploads');

export class SettingsService {
  /**
   * Fetch all settings as a key-value record.
   */
  static async getAll(): Promise<Record<string, any>> {
    const settings = await prisma.setting.findMany();
    const result: Record<string, any> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  /**
   * Fetch a single setting by key.
   */
  static async get(key: string): Promise<any | null> {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  /**
   * Upsert a setting. For JSON objects, merges with existing value to prevent
   * race conditions (e.g. updating company name without overwriting logoPath).
   */
  static async upsert(key: string, value: any): Promise<any> {
    // Read existing value first for safe merge
    const existing = await prisma.setting.findUnique({ where: { key } });

    let mergedValue = value;
    // If both existing and new values are plain objects, merge them
    if (
      existing?.value &&
      typeof existing.value === 'object' &&
      !Array.isArray(existing.value) &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      mergedValue = { ...(existing.value as Record<string, any>), ...value };
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value: mergedValue },
      create: { key, value: mergedValue },
    });

    return setting.value;
  }

  /**
   * Upload a logo file. Saves to server/uploads/ with a unique filename.
   * Deletes old logo if one exists. Returns the URL path.
   */
  static async uploadLogo(buffer: Buffer, originalName: string): Promise<string> {
    // Ensure uploads directory exists
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    // Generate unique filename
    const ext = path.extname(originalName).toLowerCase();
    const filename = `logo-${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    // Delete old logo if it exists
    const branding = await this.get('branding');
    if (branding?.logoPath) {
      const oldFilename = branding.logoPath.split('/').pop();
      if (oldFilename) {
        const oldPath = path.join(UPLOADS_DIR, oldFilename);
        try {
          await fs.unlink(oldPath);
        } catch {
          // Old file may not exist, ignore
        }
      }
    }

    // Save new file
    await fs.writeFile(filePath, buffer);

    // URL path uses forward slashes
    const urlPath = `/api/uploads/${filename}`;

    // Update branding setting with logo path
    await this.upsert('branding', { logoPath: urlPath });

    return urlPath;
  }

  /**
   * Remove the logo file from disk and clear the logoPath in settings.
   */
  static async deleteLogo(): Promise<void> {
    const branding = await this.get('branding');
    if (branding?.logoPath) {
      const filename = branding.logoPath.split('/').pop();
      if (filename) {
        const filePath = path.join(UPLOADS_DIR, filename);
        try {
          await fs.unlink(filePath);
        } catch {
          // File may not exist, ignore
        }
      }
    }

    // Set logoPath to null in branding
    await this.upsert('branding', { logoPath: null });
  }
}
