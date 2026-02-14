import crypto from 'crypto';
import { AwsClient } from 'aws4fetch';
import type { StorageAdapter } from './index';
import { sanitizeFilename } from './index';

const config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
};

let awsClient: AwsClient | null = null;

export function isR2StorageEnabled() {
  return Boolean(
    config.accountId &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.bucket &&
      config.publicBaseUrl
  );
}

function getAwsClient() {
  if (!isR2StorageEnabled()) {
    throw new Error('R2 storage is not configured');
  }
  if (!awsClient) {
    awsClient = new AwsClient({
      accessKeyId: config.accessKeyId!,
      secretAccessKey: config.secretAccessKey!,
    });
  }
  return awsClient;
}

function buildObjectUrl(path: string) {
  const base = (config.publicBaseUrl || '').replace(/\/+$/, '');
  return `${base}/${path}`;
}

function buildStorageApiUrl(path: string) {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  return `${endpoint}/${config.bucket}/${path}`;
}

function extractPathFromPublicUrl(url: string) {
  const base = (config.publicBaseUrl || '').replace(/\/+$/, '');
  if (!base) return null;
  const normalizedUrl = url.replace(/\/+$/, '');
  if (!normalizedUrl.startsWith(base)) return null;
  const path = normalizedUrl.slice(base.length).replace(/^\/+/, '');
  return path || null;
}

export const r2Adapter: StorageAdapter = {
  async save(file, opts) {
    if (!isR2StorageEnabled()) {
      throw new Error('R2 storage is not configured');
    }

    const folder = opts?.folder ?? 'uploads';
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const fname = sanitizeFilename(`${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`);
    const path = `${folder}/${fname}`;
    const contentType = file.type || 'application/octet-stream';
    const body = new Uint8Array(await file.arrayBuffer());

    const res = await getAwsClient().fetch(buildStorageApiUrl(path), {
      method: 'PUT',
      body,
      headers: {
        'content-type': contentType,
        'content-length': String(body.byteLength),
      },
      aws: {
        service: 's3',
        region: 'auto',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`R2 upload failed: ${res.status} ${errText}`.trim());
    }

    return {
      url: buildObjectUrl(path),
      remove: async () => {
        await r2Adapter.remove?.(buildObjectUrl(path));
      },
    };
  },
  async remove(url) {
    if (!isR2StorageEnabled() || !url) return;
    const path = extractPathFromPublicUrl(url);
    if (!path) return;

    const res = await getAwsClient().fetch(buildStorageApiUrl(path), {
      method: 'DELETE',
      aws: {
        service: 's3',
        region: 'auto',
      },
    });

    if (!res.ok && res.status !== 404) {
      const errText = await res.text().catch(() => '');
      throw new Error(`R2 remove failed: ${res.status} ${errText}`.trim());
    }
  },
};
