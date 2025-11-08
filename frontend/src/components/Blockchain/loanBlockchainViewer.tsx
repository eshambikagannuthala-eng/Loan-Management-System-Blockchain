import React, { useEffect, useState } from 'react';
// Import your API function to fetch the entire blockchain
import { loanBlocks } from '../../api/blockchain';

// 1. Define the Block type to match the structure returned by listAllBlocks
type Block = {
  id: number;
  loanId: string;
  transaction: string;
  previousHash: string;
  currentHash: string;
  bankName: string;
  metadata: { 
    ciphertext: string; 
    nonceHex: string 
  };
  createdAt: string;
};

type SingleLoanViewerProps = {
  loanId: number; // The specific loan ID to fetch
};

export default function SingleLoanViewer({ loanId }: SingleLoanViewerProps){
  console.log('Rendering SingleLoanViewer for loan ID:', loanId);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBlockchain = async () => {
    if (!loanId) {
        setError("Error: No loan ID provided.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        
        // 2. Replace dummy data with the actual API call
        const allBlocks = await loanBlocks(loanId);
        console.log('Fetched blocks:', allBlocks);
        
        // 3. Map the API response fields to the display fields (using the new type)
        // Note: The API response fields are already close enough, but we'll map them 
        // to be explicit for display.
        const formattedBlocks = allBlocks.map(block => ({
            id: block.id,
            loan_id: block.loanId, // Use loanId from API
            transaction_data: block.transaction, // Use transaction from API
            current_hash: block.currentHash, // Use currentHash from API
            previous_hash: block.previousHash, // Use previousHash from API
            // Include other necessary fields for the Block type defined above
            bankName: block.bankName,
            metadata: block.metadata,
            createdAt: block.createdAt,
        })) as unknown as Block[]; // Cast back to Block[]
        
        // Since we didn't update the Block type definition within the component
        // for simplicity, we use the raw data and update the render logic.
        // Let's use the actual API fields directly:
        
        setBlocks(allBlocks as unknown as Block[]);

      } catch (err: any) {
        // Axios errors often wrap the actual error response
        const errorMessage = err?.response?.data?.error || err.message || 'Failed to fetch blockchain data.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockchain();
  }, []);

  if (loading) {
    return <div className="card">Loading Blockchain...</div>;
  }

  if (error) {
    return <div className="card" style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div className="card">
      <h3>Global Loan Blockchain State 🌐</h3>
      <p style={{ color: 'var(--muted)' }}>Showing all recent blocks across all loans.</p>
      
      <div className="block-list">
        {blocks.length === 0 ? (
          <p>No blocks found in the chain.</p>
        ) : (
          blocks.map((block, index) => (
            <div key={index} className="block-entry" style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0', borderRadius: '4px' }}>
              {/* 4. Update display fields to match the API response structure */}
              <strong>Loan ID:</strong> <code> {block.loanId.substring(0, 5)}...</code>
              <br />
              <strong>Transaction:</strong> {block.transaction}
              <br />
              <strong>Bank:</strong> {block.bankName}
              <br />
              <strong>Current Hash:</strong> <code>{block.currentHash.substring(0, 15)}...</code>
              <br />
              <strong>Previous Hash:</strong> <code>{block.previousHash.substring(0, 15)}...</code>
              <br />
              <small style={{ color: 'var(--muted)' }}>Created At: {new Date(block.createdAt).toLocaleString()}</small>
            </div>
          ))
        )}
      </div>
    </div>
  );
}