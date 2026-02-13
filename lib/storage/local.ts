import type { StorageAdapter } from './index';
import { sanitizeFilename } from './index';
import { writeFile, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

export const localAdapter: StorageAdapter = {
  async save(file, opts) {
    const folder = opts?.folder ?? 'uploads';
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const fname = sanitizeFilename(`${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const dir = join(process.cwd(), 'public', folder);
    await mkdir(dir, { recursive: true });
    const dest = join(dir, fname);
    await writeFile(dest, buffer);
    return { url: `/${folder}/${fname}`, remove: async () => rm(dest, { force: true }) };
  },
  async remove(url) {
    const p = join(process.cwd(), 'public', url.startsWith('/') ? url.slice(1) : url);
    await rm(p, { force: true });
  }
};
