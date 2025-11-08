import api from './axios';

export const listBanks = async () => {
  const { data } = await api.get('/banks/list');
  return data as { bankId: string; bankName: string }[];
};
