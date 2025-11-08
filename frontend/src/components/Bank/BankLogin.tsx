// src/components/Bank/BankLogin.tsx

import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// REMOVED: export interface BankSession { ... }
// REMOVED: export const BANK_SESSION_KEY = 'BANK_SESSION';

const API_BASE_URL = 'http://localhost:5000';

// Updated Props: onDone now takes the logged-in name (e.g., bankName)
interface BankLoginProps {
    onDone: (userName: string, bankId: string) => void;
}

export const BankLogin: React.FC<BankLoginProps> = ({ onDone }) => {
    const [bankId, setBankId] = useState('');
    const [bankPassword, setBankPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/banks/login`, {
                bankId,
                bankPassword,
            });

            const { bankId: loggedInBankId, bankName: loggedInBankName } = response.data;

            // Store login info locally (using existing generic keys)
            localStorage.setItem('bankId', loggedInBankId); // Store bankId separately for the dashboard
            localStorage.setItem('userName', loggedInBankName);
            localStorage.setItem('token', 'bank_logged_in'); 
            
            // Call the success handler, passing the necessary login info
            onDone(loggedInBankName, loggedInBankId); 

        } catch (err: any) {
            const errorMessage = err.response?.data?.error || 'Login failed. Check server status or credentials.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bank-container" style={{padding: '40px 20px'}}>
            <h2 style={{textAlign: 'center', marginBottom: '20px'}}>🏦 Bank Login</h2>
            {error && <div className="message-box message-error">{error}</div>}
            <form className="bank-form" onSubmit={handleSubmit}>
                <label>
                    Bank ID:
                    <input
                        type="text"
                        value={bankId}
                        onChange={(e) => setBankId(e.target.value)}
                        required
                    />
                </label>
                <label>
                    Password:
                    <input
                        type="password"
                        value={bankPassword}
                        onChange={(e) => setBankPassword(e.target.value)}
                        required
                    />
                </label>
                <button type="submit" disabled={loading}>
                    {loading ? 'Authenticating...' : 'Login'}
                </button>
            </form>
        </div>
    );
};

export default BankLogin;