import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' }
});

// Optional: attach token if you store it
instance.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default instance;