export function toError(e: unknown, fallback = 'Bir hata oluştu') {
  const status =
    typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status?: number }).status === 'number'
      ? (e as { status: number }).status
      : 500;
  const detailedMessage =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message?: string }).message === 'string'
      ? (e as { message?: string }).message
      : null;
  const message = process.env.NODE_ENV === 'production' ? fallback : detailedMessage || fallback;
  return { status, message };
}
