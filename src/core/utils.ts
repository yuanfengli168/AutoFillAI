export const nowIso = () => new Date().toISOString();

export const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

export const normalizeText = (value?: string) => (value ?? '').trim().toLowerCase();

export const includesAny = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle));

export const uniqueStrings = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.map((item) => (item ?? '').trim()).filter(Boolean)));
