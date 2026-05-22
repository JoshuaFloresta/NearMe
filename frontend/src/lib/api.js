export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const apiRequest = async (path, options = {}) => {
  const url = `${API_BASE_URL}${path}`;
  let response;

  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    const localhostHint = API_BASE_URL.includes('localhost')
      ? ' Make sure the backend is running on http://localhost:5000, or set VITE_API_URL to your deployed backend URL.'
      : '';

    throw new Error(`Could not reach the API at ${url}.${localhostHint}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    const message = typeof data === 'string'
      ? data.replace(/<[^>]*>/g, '').trim()
      : data?.error || data?.message;

    throw new Error(message || `API request failed (${response.status}) at ${path}`);
  }

  return data;
};
