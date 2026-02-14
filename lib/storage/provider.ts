import type { StorageAdapter } from './index';
import { localAdapter } from './local';
import { isR2StorageEnabled, r2Adapter } from './r2';
import { isSupabaseStorageEnabled, supabaseAdapter } from './supabase';

type ProviderName = 'r2' | 'supabase' | 'local' | 'auto';

function resolveProvider(): ProviderName {
  const raw = (process.env.STORAGE_PROVIDER || 'auto').toLowerCase();
  if (raw === 'r2' || raw === 'supabase' || raw === 'local') return raw;
  return 'auto';
}

export function getStorageAdapter(): StorageAdapter {
  const provider = resolveProvider();

  if (provider === 'r2') {
    if (!isR2StorageEnabled()) throw new Error('STORAGE_PROVIDER=r2 but R2 env is missing');
    return r2Adapter;
  }
  if (provider === 'supabase') {
    if (!isSupabaseStorageEnabled()) {
      throw new Error('STORAGE_PROVIDER=supabase but Supabase storage env is missing');
    }
    return supabaseAdapter;
  }
  if (provider === 'local') {
    return localAdapter;
  }

  if (isR2StorageEnabled()) return r2Adapter;
  if (isSupabaseStorageEnabled()) return supabaseAdapter;
  return localAdapter;
}

