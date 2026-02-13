import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sanitizeFilename, detectContentType } from '@/lib/storage';
import { localAdapter } from '@/lib/storage/local';

const fsMocks = vi.hoisted(() => ({
  writeFile: vi.fn(),
  rm: vi.fn(),
  mkdir: vi.fn(),
}));
const supabaseMocks = vi.hoisted(() => {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/file.jpg' } });
  const remove = vi.fn().mockResolvedValue({});
  const from = vi.fn().mockReturnValue({ upload, getPublicUrl, remove });
  const createClient = vi.fn(() => ({ storage: { from } }));
  return { upload, getPublicUrl, remove, from, createClient };
});

vi.mock('fs/promises', () => fsMocks);
vi.mock('crypto', () => ({ default: { randomBytes: () => ({ toString: () => 'abcd1234' }) } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: supabaseMocks.createClient }));

import type { StorageAdapter } from '@/lib/storage';

describe('storage helpers', () => {
  it('sanitizes filenames', () => {
    const result = sanitizeFilename('My File (1).PNG');
    expect(result).toBe('my-file-1-.png');
  });

  it('truncates names longer than 64 chars', () => {
    const long = 'A'.repeat(100) + '.jpg';
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(64);
  });

  it('detects content type from File', async () => {
    const file = new File(['data'], 'test.txt', { type: 'text/plain' });
    await expect(detectContentType(file)).resolves.toBe('text/plain');
  });
});

describe('localAdapter', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('saves files and returns remove handler', async () => {
    const file = new File(['hello'], 'photo.JPG', { type: 'image/jpeg' });
    const stored = await localAdapter.save(file);
    expect(fsMocks.mkdir).toHaveBeenCalledWith(expect.stringContaining('/public/uploads'), { recursive: true });
    expect(fsMocks.writeFile).toHaveBeenCalled();
    expect(stored.url).toMatch(/\/uploads\/1000-[a-z0-9]+\.jpg/);
    expect(typeof stored.remove).toBe('function');
  });

  it('removes stored file', async () => {
    await localAdapter.remove?.('/uploads/example.jpg');
    expect(fsMocks.rm).toHaveBeenCalledWith(expect.stringContaining('/public/uploads/example.jpg'), { force: true });
  });
});

describe('supabase storage adapter', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;

  async function loadModule(): Promise<{ supabaseAdapter: StorageAdapter; isSupabaseStorageEnabled: () => boolean }> {
    return import('@/lib/storage/supabase');
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.SUPABASE_STORAGE_BUCKET = 'bucket';
    dateSpy = vi.spyOn(Date, 'now').mockReturnValue(5000);
    vi.resetModules();
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('detects env configuration presence', async () => {
    const module = await loadModule();
    expect(module.isSupabaseStorageEnabled()).toBe(true);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
    const reloaded = await loadModule();
    expect(reloaded.isSupabaseStorageEnabled()).toBe(false);
  });

  it('uploads file and returns public url', async () => {
    const { supabaseAdapter } = await loadModule();
    const file = new File(['binary'], 'coffee.png', { type: 'image/png' });
    const stored = await supabaseAdapter.save(file, { folder: 'uploads' });
    expect(supabaseMocks.createClient).toHaveBeenCalled();
    expect(supabaseMocks.upload).toHaveBeenCalled();
    expect(stored.url).toBe('https://cdn.example.com/file.jpg');
    await stored.remove?.();
    expect(supabaseMocks.remove).toHaveBeenCalled();
  });

  it('throws when supabase env missing', async () => {
    delete process.env.SUPABASE_URL;
    vi.resetModules();
    const { supabaseAdapter } = await loadModule();
    await expect(supabaseAdapter.save(new File([''], 'x.jpg'), {})).rejects.toThrow('Supabase storage is not configured');
  });
});
