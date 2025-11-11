// Dashboard.tsx
import { useState, } from 'react';
// Assuming this component fetches and displays the entire blockchain
import FullBlockChainViewer from '../components/Blockchain/fullChainViewer';
// Assuming the component to view a single loan's chain exists and takes a numeric ID
import SingleLoanViewer from '../components/Blockchain/loanBlockchainViewer';
//import ShowInfo from '../components/Blockchain/loanBlockchainViewer';
// Define types for view control
type ViewMode = 'FULL_CHAIN' | 'SINGLE_LOAN' | null;

export default function Dashboard() {
  // State for the Loan ID input (kept as string for input field)
  const [loanIdInput, setLoanIdInput] = useState('');
  // State to control which component is visible
  const [viewMode, setViewMode] = useState<ViewMode>('FULL_CHAIN'); // Start with full chain visible
  // State to store the Loan ID that has been explicitly SUBMITTED for viewing
  const [submittedLoanId, setSubmittedLoanId] = useState<number | null>(null);

  // Function to handle the "Show Chain" button click for single loan view
  const handleShowChain = () => {
    // Basic validation: ensure the input is a non-empty string that can be parsed as a number
    console.log('Entered into single loan view', loanIdInput);
    if (loanIdInput.trim() !== '') {
      // Set the submitted ID to trigger rendering of SingleLoanViewer
      setSubmittedLoanId(loanIdInput);
    } else {
      // Clear any previous submission and give feedback (optional: use a toast/alert)
      setSubmittedLoanId(null);
      alert('Please enter a valid Loan ID (number).'); 
    }
  };

  // Function to switch to the Full Chain view
  const switchToFullChain = () => {
    setViewMode('FULL_CHAIN');
    setLoanIdInput(''); // Clear input
    setSubmittedLoanId(null); // Clear submitted ID
  };
  
  // Function to switch to the Single Loan view
  const switchToSingleLoan = () => {
    setViewMode('SINGLE_LOAN');
    setSubmittedLoanId(null); // Clear submitted ID
  };


  return (
    <div className="container">
      <div className="card">
        <h2>Dashboard</h2>
        <p style={{ color: 'var(--muted)' }}>Select a view mode to see the blockchain data.</p>
        
        {/* Buttons to switch the view mode */}
        <div className="buttons" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <button 
            onClick={switchToFullChain} 
            style={{ 
              backgroundColor: viewMode === 'FULL_CHAIN' ? 'var(--primary)' : 'var(--secondary)',
              color: viewMode === 'FULL_CHAIN' ? 'white' : 'var(--text)',
              border: '1px solid #ccc',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            Show Full Blockchain
          </button>

          <button 
            onClick={switchToSingleLoan} 
            style={{ 
              backgroundColor: viewMode === 'SINGLE_LOAN' ? 'var(--primary)' : 'var(--secondary)',
              color: viewMode === 'SINGLE_LOAN' ? 'white' : 'var(--text)',
              border: '1px solid #ccc',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            View by Loan ID
          </button>
        </div>

        {/* Loan ID Input and Submission Button for Single Loan View */}
        {viewMode === 'SINGLE_LOAN' && (
          <div className="row" style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flexGrow: 1 }}>
              <label>Loan ID</label>
              <input 
                type="text" // Use type="number" for better mobile support/input validation
                value={loanIdInput} 
                onChange={e => setLoanIdInput(e.target.value)} 
                placeholder="e.g. 101" 
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
            <button
              onClick={handleShowChain}
              disabled={!loanIdInput} // Disable if input is empty
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--success)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                height: '38px', // Match height of input for alignment
              }}
            >
              Show Chain
            </button>
          </div>
        )}
      </div>

      {/* Conditional Rendering of the Viewer Component */}
      <div style={{ marginTop: 16 }}>
        {viewMode === 'FULL_CHAIN' && (
          // Renders the component to view the entire chain
          <FullBlockChainViewer />
        )}

        {viewMode === 'SINGLE_LOAN' && submittedLoanId !== null && (
          // Renders the specific component for a single loan, passing the submitted ID
          <SingleLoanViewer loanId={submittedLoanId} />
        )}
        
        {viewMode === 'SINGLE_LOAN' && submittedLoanId === null && (
          // Prompt the user to enter and submit an ID
          <p style={{ color: 'var(--muted)', marginTop: 20 }}>
            Enter a Loan ID above and click "Show Chain" to view its history.
          </p>
        )}
      </div>
    </div>
  );
}