export type StoredFile = { url: string; remove?: () => Promise<void> }
export interface StorageAdapter {
  save(file: File, opts?: { filename?: string, folder?: string }): Promise<StoredFile>;
  remove?(url: string): Promise<void>;
}
export function sanitizeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\.\-_]+/g, '-').slice(0, 64);
}
export async function detectContentType(file: File) {
  return file.type;
}
