const KEY = 'rmp_recently_viewed';
const MAX = 5;

export interface RecentProfessor {
  id: number;
  first_name: string;
  last_name: string;
  title: string;
  institution_name: string;
  avg_overall_rating: number | null;
}

export function addRecentlyViewed(prof: RecentProfessor) {
  try {
    const existing: RecentProfessor[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    const filtered = existing.filter((p) => p.id !== prof.id);
    localStorage.setItem(KEY, JSON.stringify([prof, ...filtered].slice(0, MAX)));
  } catch { /* ignore */ }
}

export function getRecentlyViewed(): RecentProfessor[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch { return []; }
}
