import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { StorageAdapter } from './index';
import { sanitizeFilename } from './index';

const config = {
  url: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_STORAGE_BUCKET,
};

let client: SupabaseClient | null = null;

export function isSupabaseStorageEnabled() {
  return Boolean(config.url && config.serviceRoleKey && config.bucket);
}

function getClient() {
  if (!isSupabaseStorageEnabled()) {
    throw new Error('Supabase storage is not configured');
  }
  if (!client) {
    client = createClient(config.url!, config.serviceRoleKey!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export const supabaseAdapter: StorageAdapter = {
  async save(file, opts) {
    if (!isSupabaseStorageEnabled()) {
      throw new Error('Supabase storage is not configured');
    }

    const folder = opts?.folder ?? 'uploads';
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const fname = sanitizeFilename(`${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`);
    const path = `${folder}/${fname}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error } = await getClient()
      .storage
      .from(config.bucket!)
      .upload(path, arrayBuffer, { contentType: file.type || 'application/octet-stream', upsert: false });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    const { data } = getClient()
      .storage
      .from(config.bucket!)
      .getPublicUrl(path);

    const url = data?.publicUrl ?? buildPublicUrl(path);

    return {
      url,
      remove: async () => {
        await getClient().storage.from(config.bucket!).remove([path]);
      },
    };
  },
  async remove(url) {
    if (!isSupabaseStorageEnabled() || !url) return;
    const path = extractPathFromUrl(url);
    if (!path) return;
    await getClient().storage.from(config.bucket!).remove([path]);
  },
};

function buildPublicUrl(path: string) {
  return `${config.url}/storage/v1/object/public/${config.bucket}/${path}`;
}

function extractPathFromUrl(url: string) {
  if (!config.bucket) return null;
  const marker = `/object/public/${config.bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
