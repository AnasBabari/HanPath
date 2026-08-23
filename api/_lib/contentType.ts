export function isJsonContentType(value?: string | string[] | null): boolean {
  if (typeof value !== 'string') return false;
  const [mediaType] = value.split(';', 1);
  return mediaType.trim().toLowerCase() === 'application/json';
}
