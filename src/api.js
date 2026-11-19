const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    credentials: 'include',
    ...options,
  })
  const data = await response.json()
  if (!response.ok)
    throw Object.assign(new Error(data.message || '连接失败，请稍后重试'), { status: response.status })
  return data
}

const post = (path, body, keepalive = false) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
  })

export const api = {
  session: () => request('/session'),
  login: (returnTo = '/') => window.location.assign(`${base}/auth/login?${new URLSearchParams({ returnTo })}`),
  logout: () => post('/auth/logout'),
  record: () => request('/records/best'),
  leaderboard: () => request('/leaderboard'),
  start: (ids, language) => post('/operations', { indicators: ids, language }),
  current: () => request('/operations/current'),
  operation: (id) => request(`/operations/${id}`),
  roundAction: ({ id, version }, action, fields) => post(`/operations/${id}/${action}`, { ...fields, version }),
  activity: (id, report, keepalive) => post(`/operations/${id}/activity`, report, keepalive),
  adminOperations: (all) => request(`/admin/operations${all ? '?all=1' : ''}`),
  adminOperation: (id) => request(`/admin/operations/${id}`),
}
