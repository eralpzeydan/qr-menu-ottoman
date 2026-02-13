const NON_ALLOWED = /[^a-z0-9\-]+/g;
const DIACRITICS = /[\u0300-\u036f]/g;

export function toProductSlug(value: string) {
  const ascii = value
    .normalize('NFKD')
    .replace(DIACRITICS, '');

  return ascii
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(NON_ALLOWED, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
