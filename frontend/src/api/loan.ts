import api from './axios';

export const initiateLoan = async (payload: {
  userName: string;
  bankId: string;
  metadataJson: string;
  userPassword: string;
  bankPassword: string;
}) => {
  const { data } = await api.post('/loan/initiate', payload);
  return data as { loanId: string; agent?: { id: string; name: string }; blockHash: string };
};

export const transitionLoan = async (loanId: string, status: 'accepted' | 'paid' | 'unpaid' | 'completed') => {
  const { data } = await api.post(`/loan/${loanId}/transition`, { status });
  return data as { blockHash: string; status: string };
};

export const getChain = async (loanId: string) => {
  const { data } = await api.get(`/loan/${loanId}/chain`);
  return data as any[];
};

export const decryptForUser = async (payload: { loanId: string; userName: string; password: string }) => {
  const { data } = await api.post(`/loan/${payload.loanId}/decrypt/for-user`, {
    userName: payload.userName,
    password: payload.password
  });
  return data as { metadata: string };
};

export const decryptForBank = async (payload: { loanId: string; bankId: string; bankPassword: string }) => {
  const { data } = await api.post(`/loan/${payload.loanId}/decrypt/for-bank`, {
    bankId: payload.bankId,
    bankPassword: payload.bankPassword
  });
  return data as { metadata: string };
};
