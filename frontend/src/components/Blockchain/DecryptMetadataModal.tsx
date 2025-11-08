import React, { useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { decryptForBank, decryptForUser } from '../../api/loan';

export default function DecryptMetadataModal({ loanId, onClose }: { loanId: string; onClose: () => void }) {
  const [role, setRole] = useState<'user' | 'bank'>('user');
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [password, setPassword] = useState('');
  const [bankId, setBankId] = useState('');
  const [metadata, setMetadata] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      if (role === 'user') {
        const res = await decryptForUser({ loanId, userName, password });
        setMetadata(JSON.parse(res.metadata));
      } else {
        const res = await decryptForBank({ loanId, bankId, bankPassword: password });
        setMetadata(JSON.parse(res.metadata));
      }
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to decrypt');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h4>Decrypt Metadata</h4>
      <div style={{ display: 'flex', gap: 16 }}>
        <label><input type="radio" checked={role==='user'} onChange={()=>setRole('user')} /> User</label>
        <label><input type="radio" checked={role==='bank'} onChange={()=>setRole('bank')} /> Bank</label>
      </div>

      {role === 'user' ? (
        <>
          <label style={{ marginTop: 8 }}>User Name</label>
          <input value={userName} onChange={e=>setUserName(e.target.value)} placeholder="chakri" />
          <label style={{ marginTop: 8 }}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </>
      ) : (
        <>
          <label style={{ marginTop: 8 }}>Bank ID</label>
          <input value={bankId} onChange={e=>setBankId(e.target.value)} placeholder="HDFC001" />
          <label style={{ marginTop: 8 }}>Bank Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </>
      )}

      <div className="buttons" style={{ marginTop: 12 }}>
        <Button onClick={submit} disabled={busy}>{busy ? 'Decrypting...' : 'Decrypt'}</Button>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>

      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {metadata && <pre className="metadata-json">{JSON.stringify(metadata, null, 2)}</pre>}
    </Modal>
  );
}