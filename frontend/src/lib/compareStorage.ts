const KEY = 'compare_ids';

export function getCompareIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as unknown[])
      .filter((n): n is number => typeof n === 'number' && n > 0)
      .slice(0, 3);
  } catch { return []; }
}

export function saveCompareIds(ids: (number | null)[]) {
  if (typeof window === 'undefined') return;
  const clean = ids.filter((n): n is number => n != null && n > 0).slice(0, 3);
  localStorage.setItem(KEY, JSON.stringify(clean));
}
