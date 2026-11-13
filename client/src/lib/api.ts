export const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';
// sessionStorage = one login per browser TAB, so you can demo several users in one browser window set.
export const getToken = () => sessionStorage.getItem('connecta_token') ?? '';
export async function api<T = any>(path: string, o: { method?: string; body?: any; form?: FormData } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { method: o.method ?? (o.body || o.form ? 'POST' : 'GET'),
      headers: { ...(o.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${getToken()}` }, body: o.form ?? (o.body ? JSON.stringify(o.body) : undefined) });
  } catch { throw new Error('Cannot reach the server. Is the backend running on ' + BASE + '?'); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && getToken()) { sessionStorage.clear(); location.href = '/login'; }
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
  return data;
}
export const fileUrl = (p: string) => `${BASE}${p}${p.includes('?') ? '&' : '?'}token=${encodeURIComponent(getToken())}`;
export const avatarUrl = (id: string) => fileUrl(`/api/users/${id}/avatar`);
export const groupPhotoUrl = (id: string) => fileUrl(`/api/groups/${id}/photo`);
export async function upload(file: Blob, name?: string) { const f = new FormData(); f.append('file', file, name); return api<{ key: string; name: string; mime: string }>('/files', { form: f }); }
