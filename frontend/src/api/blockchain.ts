import api from './axios';

export const listAllBlocks = async () => {
  const { data } = await api.get('/loan/full-chain');
  return data as { id: number; loanId: string; transaction: string; previousHash: string; currentHash: string; bankName: string; metadata: { ciphertext: string; nonceHex: string }; createdAt: string }[];
};

export const loanBlocks = async (loanId: string) => {
  console.log('API call for loanBlocks with loanId:', loanId);
  const { data } = await api.get(`/loan/${loanId}`);
  return data as { id: number; loanId: string; transaction: string; previousHash: string; currentHash: string; bankName: string; metadata: { ciphertext: string; nonceHex: string }; createdAt: string };
};