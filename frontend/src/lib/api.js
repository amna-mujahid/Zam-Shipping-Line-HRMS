const TOKEN_KEY = 'hrms.token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode */ }
};

const request = async (path, { method = 'GET', body } = {}) => {
  const token = getToken();
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, offline: true, error: 'Cannot reach the HRMS server. Is `npm run dev` running?' };
  }
  const data = await res.json().catch(() => ({ ok: false, error: `Server error (${res.status}).` }));
  if (res.status === 401) data.unauthorized = true;
  return data;
};

export const api = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  state: () => request('/api/state'),
  action: (name, args) => request(`/api/actions/${name}`, { method: 'POST', body: { args } }),
};
