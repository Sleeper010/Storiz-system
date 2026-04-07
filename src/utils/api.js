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

    // Throw a proper error for non-OK responses so callers don't
    // accidentally treat error objects as valid data (e.g. calling .filter() on them)
    if (!res.ok) {
      const message = data?.error || data?.details || data?.message || `Server error ${res.status}`;
      throw new Error(message);
    }

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
  
  if (!res.ok) {
    const message = data?.error || data?.details || data?.message || `Server error ${res.status}`;
    throw new Error(message);
  }
  
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
    list: (orderId, albumId) => apiRequest(`/api/photos/${orderId}/${albumId}`),
    register: (data) => apiRequest('/api/photos/register', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    reorder: (updates) => apiRequest('/api/photos/reorder', { 
      method: 'PUT', 
      body: JSON.stringify({ updates }) 
    }),
    delete: (id) => apiRequest(`/api/photos/${id}`, { method: 'DELETE' }),
    commit: (albumId) => apiRequest(`/api/photos/commit/${albumId}`, { method: 'POST' }),
  },
  generate: {
    create: (config, photos) => apiRequest('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ config, photos })
    })
  },
  orders: {
    list: () => apiRequest('/api/orders'),
    get: (id) => apiRequest(`/api/orders/${id}`),
    create: (data) => apiRequest('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    sync: (data) => apiRequest('/api/orders/sync', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  placements: {
    get: (albumId) => apiRequest(`/api/placements/${albumId}`),
    auto: (albumId, params) => apiRequest(`/api/placements/${albumId}/auto`, {
      method: 'POST',
      body: JSON.stringify(params)
    }),
    update: (albumId, placements) => apiRequest(`/api/placements/${albumId}`, {
      method: 'PUT',
      body: JSON.stringify({ placements })
    })
  },
  texts: {
    get: (albumId) => apiRequest(`/api/texts/${albumId}`),
    update: (albumId, texts) => apiRequest(`/api/texts/${albumId}`, {
      method: 'PUT',
      body: JSON.stringify({ texts })
    }),
    generateDefaults: (albumId, params) => apiRequest(`/api/texts/${albumId}/defaults`, {
      method: 'POST',
      body: JSON.stringify(params)
    })
  }
};
