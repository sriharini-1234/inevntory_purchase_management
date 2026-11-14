const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
  return data;
}
export const api = {
  dashboard: () => request('/dashboard'),
  products: (q='') => request(`/products${q ? `?search=${encodeURIComponent(q)}` : ''}`),
  suppliers: () => request('/suppliers'),
  transactions: (q='',type='') => {
    const params = new URLSearchParams();
    if(q) params.set('search',q);
    if(type) params.set('transaction_type',type);
    const query=params.toString();
    return request(`/transactions${query ? `?${query}` : ''}`);
  },
  addProduct: data => request('/products', {method:'POST', body:JSON.stringify(data)}),
  updateProduct: (id,data) => request(`/products/${id}`, {method:'PUT', body:JSON.stringify(data)}),
  deleteProduct: id => request(`/products/${id}`, {method:'DELETE'}),
  addSupplier: data => request('/suppliers', {method:'POST', body:JSON.stringify(data)}),
  movement: data => request('/stock/movements', {method:'POST', body:JSON.stringify(data)})
};
