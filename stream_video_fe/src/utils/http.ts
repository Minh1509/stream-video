const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:10000'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export async function httpGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal
  })

  if (!response.ok) {
    throw new HttpError(response.status, `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function httpPostForm<T>(
  path: string,
  form: FormData,
  signal?: AbortSignal
): Promise<T> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  // Note: do NOT set Content-Type manually; the browser adds the multipart
  // boundary automatically for FormData.
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
    signal
  })

  if (!response.ok) {
    throw new HttpError(response.status, `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}
