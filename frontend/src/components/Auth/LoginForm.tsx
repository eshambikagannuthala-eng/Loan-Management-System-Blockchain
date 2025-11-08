import React, { useState } from 'react';
import Button from '../UI/Button';
import { loginUser } from '../../api/auth';

export default function LoginForm({ onDone }: { onDone: () => void }) {
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      // 1. Call the login API
      // Assuming loginUser handles saving the auth token (e.g., JWT) to localStorage
      await loginUser(userName, password); 
      
      // 2. Save the user name to localStorage for use in App.tsx
      localStorage.setItem('userName', userName);
      
      setMsg('Login successful!');
      
      // 3. Call the onDone prop, which now triggers redirection in App.tsx
      onDone(); 
      
    } catch (e: any) {
      setMsg(e?.response?.data?.error || 'Failed to login');
      // Clear userName from localStorage if login failed
      localStorage.removeItem('userName'); 
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3>Login</h3>
      <label>User Name</label>
      <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="User Name" />
      <label style={{ marginTop: 8 }}>Password</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
      <div className="buttons" style={{ marginTop: 12 }}>
        <Button onClick={submit} disabled={busy || !userName || !password}>{busy ? 'Please wait...' : 'Login'}</Button>
      </div>
      {msg && <p style={{ color: msg.includes('successful') ? 'green' : 'red', marginTop: 8 }}>{msg}</p>}
    </div>
  );
}