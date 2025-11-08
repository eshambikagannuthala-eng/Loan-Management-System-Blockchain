import api from './axios';

export const registerUser = async (userName: string, password: string) => {
  const { data } = await api.post('/auth/register', { userName, password });
  localStorage.setItem('token', data.token);
  localStorage.setItem('userName', userName);
  return data;
};

export const loginUser = async (userName: string, password: string) => {
  const { data } = await api.post('/auth/login', { userName, password });
  localStorage.setItem('token', data.token);
  localStorage.setItem('userName', userName);
  return data;
};
