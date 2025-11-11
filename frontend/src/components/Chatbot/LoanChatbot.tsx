import React, { useEffect, useMemo, useState } from 'react';
import Button from '../UI/Button';
import { listBanks } from '../../api/bank';
import { initiateLoan } from '../../api/loan';
import { fileToBase64, filesToBase64Array } from '../../utils/files';

type StepType = 'select' | 'text' | 'file' | 'file-multiple' | 'number' | 'boolean' | 'password';

type Step = { key: string; label: string; type: StepType; dependsOn?: string; };

const steps: Step[] = [
  { key: 'bankId', label: 'Select Bank', type: 'select' },
  { key: 'aadhaar', label: 'Aadhaar Number', type: 'text' },
  { key: 'aadhaarImage', label: 'Upload Aadhaar Image', type: 'file' },
  { key: 'pan', label: 'PAN Number', type: 'text' },
  { key: 'panImage', label: 'Upload PAN Image', type: 'file' },
  { key: 'isEmployee', label: 'Are you currently employed?', type: 'boolean' },
  { key: 'currentCompany', label: 'Current Company', type: 'text', dependsOn: 'isEmployee' },
  { key: 'currentSalary', label: 'Current Salary', type: 'number', dependsOn: 'isEmployee' },
  { key: 'experienceYears', label: 'Years of Experience', type: 'number' },
  { key: 'relievingLetter', label: 'Relieving Letter available?', type: 'boolean' },
  { key: 'cibilImage', label: 'Upload CIBIL Score Image', type: 'file' },
  { key: 'supportingDocs', label: 'Supporting Documents', type: 'file-multiple' },
  { key: 'loanAmount', label: 'Loan Amount', type: 'number' },
  { key: 'userPassword', label: 'Enter your password (for metadata view later)', type: 'password' },
  { key: 'bankPassword', label: 'Enter bank password (verification only)', type: 'password' }
];

export default function LoanChatbot({ onInitiated }: { onInitiated: (loanId: string) => void }) {
  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState<any>({});
  const [banks, setBanks] = useState<{ bankId: string; bankName: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => { (async () => { setBanks(await listBanks()); })(); }, []);

  const step = steps[idx];
  const canShow = (s: Step) => {
    if (!s.dependsOn) return true;
    return !!form[s.dependsOn];
  };

  const update = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const prev = () => setIdx(i => Math.max(i - 1, 0));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, key: string, multiple = false) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (multiple) {
      update(`${key}Base64Array`, await filesToBase64Array(e.target.files));
    } else {
      update(`${key}Base64`, await fileToBase64(e.target.files[0]));
    }
  };

  const reviewData = useMemo(() => ({
    bankId: form.bankId,
    aadhaar: form.aadhaar,
    pan: form.pan,
    employment: {
      isEmployee: form.isEmployee,
      currentCompany: form.currentCompany,
      currentSalary: form.currentSalary,
      experienceYears: form.experienceYears,
      relievingLetter: form.relievingLetter
    },
    loanAmount: form.loanAmount
  }), [form]);

  const apply = async () => {
    setBusy(true);
    try {
      const metadataJson = JSON.stringify({
        bankId: form.bankId,
        aadhaar: form.aadhaar,
        aadhaarImage: form.aadhaarImageBase64,
        pan: form.pan,
        panImage: form.panImageBase64,
        employment: {
          isEmployee: form.isEmployee,
          currentCompany: form.currentCompany,
          currentSalary: form.currentSalary,
          experienceYears: form.experienceYears,
          relievingLetter: form.relievingLetter
        },
        cibilImage: form.cibilImageBase64,
        supportingDocs: form.supportingDocsBase64Array || [],
        loanAmount: form.loanAmount
      });

      const res = await initiateLoan({
        userName: localStorage.getItem('userName') || '',
        bankId: form.bankId,
        metadataJson,
        userPassword: form.userPassword,
        bankPassword: form.bankPassword
      });

      alert(`Loan initiated.\nLoan ID: ${res.loanId}\nAgent: ${res.agent?.name || 'N/A'}`);
      onInitiated(res.loanId);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to initiate loan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Apply for Loan</h2>
      <p style={{ color: 'var(--muted)' }}>Answer one-by-one. You can review before submitting.</p>
      <hr />

      <div>
        <label>{step.label}</label>
        {step.type === 'select' && (
          <select value={form.bankId || ''} onChange={e => update('bankId', e.target.value)}>
            <option value="" disabled>Select a bank</option>
            {banks.map(b => <option key={b.bankId} value={b.bankId}>{b.bankName} ({b.bankId})</option>)}
          </select>
        )}

        {step.type === 'text' && (
          <input value={form[step.key] || ''} onChange={e => update(step.key, e.target.value)} placeholder={`Enter ${step.label}`} />
        )}

        {step.type === 'number' && (
          <input type="number" value={form[step.key] || ''} onChange={e => update(step.key, Number(e.target.value))} placeholder={`Enter ${step.label}`} />
        )}

        {step.type === 'boolean' && (
          <div className="buttons">
            <Button variant={form[step.key] === true ? 'primary' : 'secondary'} onClick={() => update(step.key, true)}>Yes</Button>
            <Button variant={form[step.key] === false ? 'primary' : 'secondary'} onClick={() => update(step.key, false)}>No</Button>
          </div>
        )}

        {step.type === 'file' && (
          <input type="file" accept="image/*,.pdf" onChange={e => handleFile(e, step.key)} />
        )}

        {step.type === 'file-multiple' && (
          <input type="file" multiple accept="image/*,.pdf" onChange={e => handleFile(e, step.key, true)} />
        )}

        {step.type === 'password' && (
          <input type="password" value={form[step.key] || ''} onChange={e => update(step.key, e.target.value)} placeholder="Enter password" />
        )}
      </div>

      <div className="buttons" style={{ marginTop: 16 }}>
        <Button variant="secondary" onClick={prev} disabled={idx === 0}>Back</Button>
        <Button onClick={() => {
          // Skip conditional steps if hidden
          let nextIdx = idx + 1;
          while (nextIdx < steps.length && !canShow(steps[nextIdx])) nextIdx++;
          setIdx(Math.min(nextIdx, steps.length - 1));
        }} disabled={idx >= steps.length - 1}>Next</Button>
        <Button variant="secondary" onClick={() => setReviewOpen(true)}>Review</Button>
        <Button onClick={apply} disabled={idx < steps.length - 1 || busy} >
          {busy ? 'Applying...' : 'Apply (Initiate)'}
        </Button>
      </div>

      {reviewOpen && (
        <div className="card" style={{ marginTop: 16 }}>
          <h4>Review</h4>
          <pre className="metadata-json">{JSON.stringify(reviewData, null, 2)}</pre>
          <div className="buttons">
            <Button variant="secondary" onClick={() => setReviewOpen(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}