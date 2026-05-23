export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const getStoredToken = () => {
  try {
    return localStorage.getItem('nearme_token') || '';
  } catch {
    return '';
  }
};

export const clearStoredAuth = () => {
  try {
    localStorage.removeItem('nearme_token');
    localStorage.removeItem('nearme_user');
    window.dispatchEvent(new Event('nearme:user-updated'));
  } catch {
    // localStorage may be unavailable in private/embedded contexts.
  }
};

export const apiRequest = async (path, options = {}) => {
  const url = `${API_BASE_URL}${path}`;
  let response;
  const token = getStoredToken();
  const { headers: optionHeaders = {}, ...fetchOptions } = options;

  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...optionHeaders,
      },
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

    if (response.status === 401) clearStoredAuth();

    throw new Error(message || `API request failed (${response.status}) at ${path}`);
  }

  return data;
};

export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read image file'));
  reader.readAsDataURL(file);
});

export const uploadImage = async (file, purpose = 'general') => {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Please choose an image under 5 MB');
  }

  const fileData = await fileToDataUrl(file);
  const upload = await apiRequest('/api/uploads/image', {
    method: 'POST',
    body: JSON.stringify({ file: fileData, purpose }),
  });

  return upload.url;
};
