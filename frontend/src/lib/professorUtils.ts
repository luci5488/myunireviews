export function roleLabel(title: string | undefined): string {
  if (!title) return 'professor';
  const t = title.toLowerCase();
  if (t === 'tutor') return 'tutor';
  if (t.includes('lecturer')) return 'lecturer';
  return 'professor';
}
