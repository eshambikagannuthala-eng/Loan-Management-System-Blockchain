import React, { useState } from 'react';
import Button from '../UI/Button';
import { registerUser } from '../../api/auth';

export default function RegisterForm({ onDone }: { onDone: () => void }) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      await registerUser(userName, password);
      setMsg('Registered successfully!');
      onDone();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || 'Failed to register');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3>Create Account</h3>
      <label>User Name</label>
      <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="chakri" />
      <label style={{ marginTop: 8 }}>Password</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
      <div className="buttons" style={{ marginTop: 12 }}>
        <Button onClick={submit} disabled={busy}>{busy ? 'Please wait...' : 'Register'}</Button>
      </div>
      {msg && <p style={{ color: 'var(--muted)', marginTop: 8 }}>{msg}</p>}
    </div>
  );
}