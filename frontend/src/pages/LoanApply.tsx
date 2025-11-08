import React, { useState } from 'react';
import LoanChatbot from '../components/Chatbot/LoanChatbot';
import ChainViewer from '../components/Blockchain/ChainViewer';

export default function LoanApply() {
  const [loanId, setLoanId] = useState<string>('');

  return (
    <div className="container">
      <LoanChatbot onInitiated={(id) => setLoanId(id)} />
      {loanId && <div style={{ marginTop: 16 }}>
        <ChainViewer loanId={loanId} />
      </div>}
    </div>
  );
}
