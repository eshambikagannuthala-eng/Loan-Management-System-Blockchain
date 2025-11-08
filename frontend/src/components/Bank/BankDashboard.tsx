// src/components/Bank/BankDashboard.tsx

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
// REMOVED: import { BankSession, BANK_SESSION_KEY } from './BankLogin'; 

// Define data structures
interface Loan {
    loanId: string;
    latestStatus: string;
    user: string;
    latestBlockHash: string;
    initiatedAt: string;
    metadataJson: string; 
}

type Status = "accepted" | "paid" | "unpaid" | "completed" | "closed";

const API_BASE_URL = 'http://localhost:5000';

// Updated Props: takes bankName and bankId directly
interface BankDashboardProps {
    bankName: string;
    bankId: string;
    onLogout: () => void;
}

const BankDashboard: React.FC<BankDashboardProps> = ({ bankName, bankId, onLogout }) => {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState<Status>('accepted');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const navigate = useNavigate();

    const transitionOptions: { label: string, value: Status }[] = [
        { label: "Accept Loan", value: "accepted" },
        { label: "Mark Paid", value: "paid" },
        { label: "Mark Unpaid", value: "unpaid" },
        { label: "Mark Completed", value: "completed" },
    ];

    const fetchLoans = useCallback(async () => {
        setLoading(true);
        try {
            // Use the bankId prop
            const response = await axios.get<Loan[]>(`${API_BASE_URL}/loan/bank/${bankId}`);
            setLoans(response.data.filter(loan => loan && loan.loanId));
            setMessage(null);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to fetch loans.' });
            setLoans([]);
        } finally {
            setLoading(false);
        }
    }, [bankId]); // Dependency updated to bankId

    useEffect(() => {
        fetchLoans();
    }, [fetchLoans]);

    const handleTransition = async (loanId: string, status: Status) => {
        setMessage(null);
        setLoading(true); 
        
        try {
            const endpoint = status === 'closed' 
                ? `${API_BASE_URL}/loan/${loanId}/close`
                : `${API_BASE_URL}/loan/${loanId}/transition`;
            
            const payload = status === 'closed'
                ? { bankId: bankId } // Use the bankId prop
                : { status: status };

            const response = await axios.post(endpoint, payload);

            setMessage({ 
                type: 'success', 
                text: `Loan ${loanId} successfully transitioned to ${response.data.newStatus || 'closed'}.` 
            });
            
            fetchLoans();

        } catch (err: any) {
            setMessage({ 
                type: 'error', 
                text: err.response?.data?.error || `Failed to transition loan ${loanId}.` 
            });
        } finally {
            setLoading(false);
        }
    };

    const getStatusClass = (status: string) => `loan-status-text status-${status.toLowerCase()}`;
    
    return (
        <div className="bank-container">
            <div className="dashboard-header">
                {/* Use the bankName prop */}
                <h2>🏦 {bankName} Loan Dashboard</h2>
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    {/* Use the bankId prop */}
                    <p style={{margin: 0}}>Logged in as: <strong>{bankId}</strong></p>
                    <button onClick={onLogout} className="action-panel button" style={{padding: '8px 12px'}}>Logout</button>
                </div>
            </div>

            {message && (
                <div className={`message-box message-${message.type}`}>
                    {message.text}
                </div>
            )}
            
            <button onClick={fetchLoans} className="action-panel button" style={{marginBottom: '15px'}} disabled={loading}>
                {loading ? 'Loading...' : '🔄 Refresh Loans'}
            </button>

            <div className="loan-list">
                {loans.length === 0 && !loading ? (
                    <p>No loans found for this bank.</p>
                ) : (
                    loans.map((loan) => (
                        <div key={loan.loanId} className="loan-item">
                            <div className="loan-info">
                                <h4>Loan ID: {loan.loanId} (User: {loan.user})</h4>
                                <p>Status: <span className={getStatusClass(loan.latestStatus)}>{loan.latestStatus}</span></p>
                                <p style={{marginTop: '5px'}}>
                                    Metadata: 
                                    <code style={{backgroundColor: '#eee', padding: '2px 4px', borderRadius: '3px', fontSize: '0.8em'}}>
                                        {loan.metadataJson}
                                    </code>
                                </p>
                            </div>

                            <div className="action-panel">
                                {/* 1. Transition Status Dropdown */}
                                <select 
                                    value={selectedStatus} 
                                    onChange={(e) => setSelectedStatus(e.target.value as Status)}
                                    disabled={loading || loan.latestStatus === 'closed'}
                                >
                                    <option value="" disabled>Select Status</option>
                                    {transitionOptions.map(opt => (
                                        <option 
                                            key={opt.value} 
                                            value={opt.value}
                                        >
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <button 
                                    onClick={() => handleTransition(loan.loanId, selectedStatus)}
                                    disabled={loading || loan.latestStatus === 'closed'}
                                >
                                    Transition
                                </button>
                                
                                {/* 2. Close Loan Button (New Bank API) */}
                                <button 
                                    onClick={() => handleTransition(loan.loanId, 'closed')}
                                    className="close-button"
                                    disabled={loading || loan.latestStatus === 'closed'}
                                >
                                    {loan.latestStatus === 'closed' ? 'Closed' : 'Close Loan'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default BankDashboard;