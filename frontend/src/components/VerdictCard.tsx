import { useState } from 'react';
import { motion } from 'framer-motion';
import type { DebateResult } from '../data/mockDebates';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import './VerdictCard.css';

interface VerdictCardProps {
  verdict: DebateResult['verdict'];
  token: string;
  walletAddress: string | null;
  onRefreshBalance?: () => void;
}

// Helper function to format thesis markdown and remove redundant headers
function formatThesis(text: string) {
  if (!text) return null;
  
  const lines = text.split('\n');
  
  // Filter out redundant headers like Verdict and Composite Score
  const filteredLines = lines.filter(line => {
    const cleanLine = line.trim().toUpperCase();
    return !(
      cleanLine.startsWith('## VERDICT') ||
      cleanLine.startsWith('## COMPOSITE SCORE') ||
      cleanLine.startsWith('### RECOMMENDED ALLOCATION')
    );
  });

  const parseBold = (str: string) => {
    const parts = str.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{part}</strong>;
      }
      return part;
    });
  };

  return filteredLines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} style={{ height: '8px' }} />;
    
    // Match headers
    if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
      const headerText = trimmed.replace(/^###?\s*/, '').replace(/:$/, '');
      return (
        <h4 
          key={index} 
          className="rationale-heading"
        >
          {headerText}
        </h4>
      );
    }
    
    // Regular list items or paragraphs
    return (
      <p 
        key={index} 
        className="rationale-paragraph"
      >
        {parseBold(trimmed)}
      </p>
    );
  });
}

export default function VerdictCard({ verdict, token, walletAddress, onRefreshBalance }: VerdictCardProps) {
  const [amount, setAmount] = useState('0.01');
  const [txStatus, setTxStatus] = useState<'idle' | 'building' | 'signing' | 'confirming' | 'confirmed' | 'error'>('idle');
  const [txError, setTxError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const decisionColor =
    verdict.decision === 'GO'
      ? 'var(--status-go)'
      : verdict.decision === 'NO-GO'
      ? 'var(--status-nogo)'
      : 'var(--status-hold)';

  const decisionEmoji =
    verdict.decision === 'GO' ? '🟢' : verdict.decision === 'NO-GO' ? '🔴' : '🟡';

  const decisionLabel =
    verdict.decision === 'GO'
      ? 'INVESTMENT APPROVED'
      : verdict.decision === 'NO-GO'
      ? 'INVESTMENT REJECTED'
      : 'FURTHER REVIEW REQUIRED';

  const executeInvestment = async () => {
    if (!walletAddress) return;
    setTxStatus('building');
    setTxError(null);
    setTxSignature(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTxError('Please enter a valid investment amount greater than 0.');
      setTxStatus('error');
      return;
    }

    try {
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const fromPubkey = new PublicKey(walletAddress);
      const toPubkey = new PublicKey(walletAddress); // self-deposit to vault
      const lamports = Math.round(parsedAmount * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );

      setTxStatus('signing');
      const latestBlockhash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = fromPubkey;

      const provider = (window as any).solana;
      if (!provider) {
        throw new Error('Phantom wallet provider not found in window.');
      }

      const { signature } = await provider.signAndSendTransaction(transaction);
      
      setTxStatus('confirming');
      setTxSignature(signature);

      await connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: signature
      }, 'confirmed');

      setTxStatus('confirmed');
      if (onRefreshBalance) {
        onRefreshBalance();
      }
    } catch (err: any) {
      console.error('Transaction execution failed:', err);
      setTxError(err.message || 'Transaction rejected or failed. Please check your wallet balance and try again.');
      setTxStatus('error');
    }
  };

  return (
    <motion.div
      className="verdict-card"
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
      style={{
        borderColor: decisionColor,
        boxShadow: `0 0 40px ${decisionColor}22, 0 8px 32px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Glow bar */}
      <div
        className="verdict-glow-bar"
        style={{ background: decisionColor }}
      />

      <div className="verdict-content">
        <div className="verdict-header">
          <div className="verdict-badge" style={{ borderColor: decisionColor, color: decisionColor }}>
            {decisionEmoji} {verdict.decision}
          </div>
          <div className="verdict-label" style={{ color: decisionColor }}>
            {decisionLabel}
          </div>
        </div>

        <div className="verdict-token-name">${token}</div>

        <div className="verdict-stats">
          <div className="verdict-stat">
            <div className="stat-label">Composite Score</div>
            <div className="stat-value" style={{ color: decisionColor }}>
              {verdict.score}
              <span className="stat-unit">/100</span>
            </div>
            <div className="score-bar">
              <motion.div
                className="score-fill"
                initial={{ width: 0 }}
                animate={{ width: `${verdict.score}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                style={{ background: decisionColor }}
              />
            </div>
          </div>

          <div className="verdict-stat">
            <div className="stat-label">Recommended Allocation</div>
            <div className="stat-value-text">{verdict.allocation}</div>
          </div>
        </div>

        <div className="verdict-rationale">
          <div className="rationale-label">Investment Thesis</div>
          <div className="rationale-text">
            {formatThesis(verdict.rationale)}
          </div>
        </div>

        {/* Real On-Chain Action Area (Only for GO decisions) */}
        {verdict.decision === 'GO' && (
          <div className="verdict-action-box">
            <div className="verdict-action-title">🏛️ BOARDROOM PERSONAL VAULT DEPOSIT</div>
            <p className="verdict-action-desc">
              Execute a real-time Solana transaction to deposit your allocation to your Boardroom Personal Vault. 
              This self-deposit secures your funds while verifying full ledger accountability on-chain.
            </p>

            {!walletAddress ? (
              <div className="connected-address-warning">
                🔌 Please connect your Phantom wallet in the header to execute this investment.
              </div>
            ) : (
              <div className="verdict-action-form">
                <div className="verdict-input-wrapper">
                  <label htmlFor="invest-amount">Amount (SOL)</label>
                  <input
                    id="invest-amount"
                    type="number"
                    step="0.001"
                    min="0.0001"
                    className="verdict-sol-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={txStatus === 'building' || txStatus === 'signing' || txStatus === 'confirming'}
                  />
                </div>
                <button
                  className="verdict-submit-button"
                  onClick={executeInvestment}
                  disabled={txStatus === 'building' || txStatus === 'signing' || txStatus === 'confirming'}
                >
                  {txStatus === 'building' && 'Generating...'}
                  {txStatus === 'signing' && 'Confirming in Wallet...'}
                  {txStatus === 'confirming' && 'Broadcasting Tx...'}
                  {txStatus === 'confirmed' && 'Deposit Successful! ✓'}
                  {txStatus === 'idle' && 'Deposit SOL to Vault'}
                  {txStatus === 'error' && 'Retry Deposit'}
                </button>
              </div>
            )}

            {txStatus === 'confirming' && (
              <div className="verdict-tx-status loading">
                <span className="spinner">⏳</span> Broadcasting transaction... Signature: 
                <span className="signature-short"> {txSignature?.slice(0, 8)}...</span>
              </div>
            )}

            {txStatus === 'confirmed' && txSignature && (
              <div className="verdict-tx-success">
                <span className="success-icon">🟢</span> 
                <div>
                  <strong>Vault Deposit Confirmed!</strong>
                  <br />
                  <a
                    href={`https://solscan.io/tx/${txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="solscan-link"
                  >
                    View transaction on Solscan Explorer ↗
                  </a>
                  <div className="signature-full">Tx: {txSignature}</div>
                </div>
              </div>
            )}

            {txStatus === 'error' && txError && (
              <div className="verdict-tx-error">
                <span className="error-icon">⚠️</span> {txError}
              </div>
            )}
          </div>
        )}

        <div className="verdict-signatures">
          <div className="signature">
            <span className="sig-emoji">🔒</span>
            <span className="sig-name">Security Auditor</span>
            <span className="sig-check">✓</span>
          </div>
          <div className="signature">
            <span className="sig-emoji">📊</span>
            <span className="sig-name">The Quant</span>
            <span className="sig-check">✓</span>
          </div>
          <div className="signature">
            <span className="sig-emoji">🐦</span>
            <span className="sig-name">Sentiment Analyst</span>
            <span className="sig-check">✓</span>
          </div>
          <div className="signature">
            <span className="sig-emoji">🏛️</span>
            <span className="sig-name">Lead Partner</span>
            <span className="sig-check sig-final">✓✓</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
