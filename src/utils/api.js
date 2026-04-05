const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

export async function apiRequest(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (res.status === 401 && path !== '/api/auth/check' && path !== '/api/auth/login') {
      // Only reload if a protected generic API call gets an unexpected 401
      window.location.reload();
      return null;
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

export async function apiUpload(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });

  const data = await res.json();
  return data;
}

export const api = {
  auth: {
    login: (password) => apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    }),
    check: () => apiRequest('/api/auth/check'),
    logout: () => apiRequest('/api/auth/logout', { method: 'POST' })
  },
  shopify: {
    getOrders: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/api/shopify/orders?${qs}`);
    },
    getOrder: (id) => apiRequest(`/api/shopify/orders/${id}`)
  },
  destinations: {
    list: () => apiRequest('/api/destinations'),
    create: (data) => apiRequest('/api/destinations', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    import: (formData) => apiUpload('/api/destinations/import', formData),
    update: (id, data) => apiRequest(`/api/destinations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => apiRequest(`/api/destinations/${id}`, { method: 'DELETE' })
  },
  photos: {
    upload: (formData) => apiUpload('/api/photos/upload', formData)
  },
  generate: {
    create: (config, photos) => apiRequest('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ config, photos })
    })
  }
};
