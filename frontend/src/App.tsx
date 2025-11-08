import React, { useState, useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom';
import './styles/theme.css';

import Dashboard from './pages/Dashboard';
import LoanApply from './pages/LoanApply';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import Button from './components/UI/Button'; 
import './components/Bank/BankStyles.css'; // Add this line to the top of App.tsx or index.tsx

// Import Bank Components (assuming you'll place them in the correct path)
import BankLogin from './components/Bank/BankLogin';
import BankDashboard from './components/Bank/BankDashboard';

// --- Auth Helper Functions ---

// Check for EITHER user token ('token') OR bank token ('bank_logged_in' is set to 'token')
const getAuthStatus = () => !!localStorage.getItem('token'); 
const getUserName = () => localStorage.getItem('userName') || '';

// NEW: Check for Bank Specific Session Keys
const getBankId = () => localStorage.getItem('bankId') || null;
const getBankName = () => localStorage.getItem('userName') || null; // Banks also use 'userName' for display
const isBankLoggedIn = () => localStorage.getItem('token') === 'bank_logged_in';

// --- Main App Component ---

export default function App() {
  // User Login State (for general users)
  const [isLoggedIn, setIsLoggedIn] = useState(getAuthStatus());
  const [userName, setUserName] = useState(getUserName());
  
  // Bank Login State (for bank users)
  const [bankId, setBankId] = useState<string | null>(getBankId());
  const [bankName, setBankName] = useState<string | null>(isBankLoggedIn() ? getBankName() : null);

  // Determine if the current session is a Bank session or a standard User session
  const isBankSession = isBankLoggedIn();

  const handleLogout = () => {
    // Clear all potential login keys
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('bankId');
    
    // Reset all states
    setIsLoggedIn(false);
    setUserName('');
    setBankId(null);
    setBankName(null);
    
    window.location.href = '/login'; // Redirect to login
  };

  return (
    <BrowserRouter>
      <AppContent 
        isLoggedIn={isLoggedIn} 
        userName={userName}
        isBankSession={isBankSession} // Pass bank session flag
        bankId={bankId} // Pass bank session data
        bankName={bankName} // Pass bank session data
        setIsLoggedIn={setIsLoggedIn} 
        setUserName={setUserName}
        setBankId={setBankId} // New setter for bankId
        setBankName={setBankName} // New setter for bankName
        handleLogout={handleLogout}
      />
    </BrowserRouter>
  );
}

// --- App Content Component ---

function AppContent({ 
    isLoggedIn, userName, isBankSession, bankId, bankName, 
    setIsLoggedIn, setUserName, setBankId, setBankName, handleLogout 
}: any) {
  const navigate = useNavigate();

  // 1. Standard User Login Success
  const handleUserLoginSuccess = () => {
    const newUserName = getUserName();
    // Ensure bank keys are cleared if a user logs in (optional safety measure)
    localStorage.removeItem('bankId'); 
    
    setIsLoggedIn(true);
    setUserName(newUserName);
    setBankId(null);
    setBankName(null);
    navigate('/'); 
  };
  
  // 2. Bank Login Success (Uses the simplified logic from the previous answer)
  const handleBankLoginSuccess = (name: string, id: string) => {
    // Note: BankLogin already sets localStorage.setItem('token', 'bank_logged_in');
    // and localStorage.setItem('userName', bankName);
    localStorage.setItem('bankId', id);

    setIsLoggedIn(true); // General login status is true
    setUserName(name); // Use bank name for general user display
    setBankId(id); 
    setBankName(name); 
    navigate('/bank/dashboard'); 
  };


  const handleRegisterSuccess = () => {
    navigate('/login');
  };

  // Determine the display name for the header
  const currentUserName = isBankSession ? bankName : userName;

  return (
    <>
      <header style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>LoanChain</h2>
          <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            
            {/* Navigation Links for Logged-In Users/Banks */}
            {isLoggedIn && (
              <>
                {/* Standard user links */}
                {!isBankSession && (
                  <>
                    <Link to="/" style={{ color: 'var(--text)' }}>Dashboard</Link>
                    <Link to="/apply" style={{ color: 'var(--text)' }}>Apply</Link>
                  </>
                )}
                {/* Bank user link */}
                {isBankSession && (
                    <Link to="/bank/dashboard" style={{ color: 'var(--text)' }}>Bank Dashboard</Link>
                )}

                <span style={{ color: 'var(--text-light)', fontWeight: 'bold' }}>Hello, {currentUserName}</span>
                <Button onClick={handleLogout} style={{ padding: '4px 8px' }} variant="secondary">Logout</Button>
              </>
            )}

            {/* Navigation Links for Logged-Out Guests */}
            {!isLoggedIn && (
              <>
                <Link to="/login" style={{ color: 'var(--text)' }}>User Login</Link>
                <Link to="/register" style={{ color: 'var(--text)' }}>User Register</Link>
                <Link to="/bank/login" style={{ color: 'var(--primary-color)' }}>Bank Login</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <Routes>
          {/* --- USER ROUTES --- */}
          <Route path="/" element={
            !isLoggedIn ? 
              <div className="container"><LoginForm onDone={handleUserLoginSuccess} /></div> : 
              (isBankSession ? <div className="container">Welcome, Bank! Go to <Link to="/bank/dashboard">Bank Dashboard</Link>.</div> : <Dashboard />)
          } />
          <Route path="/apply" element={
            isLoggedIn && !isBankSession ? 
              <LoanApply /> : 
              <div className="container">Please <Link to="/login">login as a user</Link> to apply for a loan.</div>
          } />
          
          {/* Login and Register routes (redirect if already logged in) */}
          <Route path="/login" element={<div className="container"><LoginForm onDone={handleUserLoginSuccess} /></div>} />
          <Route path="/register" element={<div className="container"><RegisterForm onDone={handleRegisterSuccess} /></div>} />
          
          {/* --- BANK ROUTES --- */}
          <Route path="/bank/login" element={
            isLoggedIn && isBankSession ?
              <div className="container">Already logged in. Go to <Link to="/bank/dashboard">Bank Dashboard</Link></div> :
              <div className="container"><BankLogin onDone={handleBankLoginSuccess} /></div>
          } />
          <Route path="/bank/dashboard" element={
            // Check specifically for Bank Session
            isLoggedIn && isBankSession && bankId && bankName ? (
                <BankDashboard 
                    bankId={bankId}
                    bankName={bankName}
                    onLogout={handleLogout} 
                />
            ) : (
                <div className="container">Please <Link to="/bank/login">log in as a bank</Link> to view the dashboard.</div>
            )
          } />

        </Routes>
      </main>
    </>
  );
}