// TODO: 对接网协通行证
export async function login(credentials) {
  if (!process.env.AUTH_API_URL) return null
  const response = await fetch(`${process.env.AUTH_API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || '登录失败，请重试')
  return result
}
