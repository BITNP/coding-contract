const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || '连接失败，请稍后重试')
  return data
}

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  session: () => request('/session'),
  login: (credentials) => post('/auth/login', credentials),
  logout: () => post('/auth/logout'),
  record: () => request('/records/best'),
  start: (ids, language) => post('/operations', { indicators: ids, language }),
  operation: (id) => request(`/operations/${id}`),
  sample: (id, submission) => post(`/operations/${id}/sample`, submission),
  submit: (id, submission) => post(`/operations/${id}/submit`, submission),
}
