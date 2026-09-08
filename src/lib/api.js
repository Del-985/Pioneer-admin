const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://api.pioneerlegacyworks.onrender.com'
).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, code = null, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(options.headers || {});

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const apiError = payload && typeof payload === 'object' ? payload.error : null;
    const message =
      apiError?.message ||
      (payload && typeof payload === 'object' && payload.message) ||
      `Request failed with status ${response.status}`;

    throw new ApiError(
      message,
      response.status,
      apiError?.code || null,
      apiError?.details || null,
    );
  }

  return payload;
}

export { API_BASE_URL };
