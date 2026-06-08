import axios from 'axios'

const BACKEND_PORT = '8999'

function isLocalHostName(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function resolveApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_AIPS_API_BASE_URL || '').trim().replace(/\/$/, '')
  const { protocol, hostname } = window.location

  if (envUrl) {
    return envUrl
  }

  if (isLocalHostName(hostname)) {
    return `http://127.0.0.1:${BACKEND_PORT}/api`
  }

  return `${protocol}//${hostname}:${BACKEND_PORT}/api`
}

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('aips_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[AIPS API ERROR]', {
      method: error?.config?.method,
      baseURL: error?.config?.baseURL,
      url: error?.config?.url,
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    })

    return Promise.reject(error)
  },
)

export default apiClient
