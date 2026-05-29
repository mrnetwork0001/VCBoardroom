import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { DebateResult } from '../data/mockDebates';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import './VerdictCard.css';

const SOLANA_MINT_MAP: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
};

interface VerdictCardProps {
  verdict: DebateResult['verdict'];
  token: string;
  walletAddress: string | null;
  onRefreshBalance?: () => void;
  degenMode?: boolean;
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

export default function VerdictCard({ verdict, token, walletAddress, onRefreshBalance, degenMode }: VerdictCardProps) {
  const [amount, setAmount] = useState('0.01');
  const [txStatus, setTxStatus] = useState<'idle' | 'building' | 'signing' | 'confirming' | 'confirmed' | 'error'>('idle');
  const [txError, setTxError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Jupiter Swap states
  const [activeTab, setActiveTab] = useState<'vault' | 'swap'>('vault');
  const [swapAmount, setSwapAmount] = useState('0.05');
  const [mintAddress, setMintAddress] = useState<string | null>(null);
  const [expectedOutput, setExpectedOutput] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState<string | null>(null);
  const [swapTxStatus, setSwapTxStatus] = useState<'idle' | 'building' | 'signing' | 'confirming' | 'confirmed' | 'error'>('idle');
  const [swapTxError, setSwapTxError] = useState<string | null>(null);
  const [swapTxSignature, setSwapTxSignature] = useState<string | null>(null);

  // Fetch token mint address
  useEffect(() => {
    const localMint = SOLANA_MINT_MAP[token.toUpperCase()];
    if (localMint) {
      setMintAddress(localMint);
      return;
    }

    const fetchMint = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const resp = await fetch(`${API_BASE}/api/market-data/${token}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.coingecko?.solana_mint) {
            setMintAddress(data.coingecko.solana_mint);
          }
        }
      } catch (e) {
        console.error('Failed to fetch token mint address:', e);
      }
    };
    fetchMint();
  }, [token]);

  // Fetch Jupiter Quote
  const fetchQuote = async (val: string) => {
    if (!mintAddress) return;
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed <= 0) {
      setExpectedOutput(null);
      setPriceImpact(null);
      return;
    }

    setQuoteLoading(true);
    try {
      const lamports = Math.round(parsed * LAMPORTS_PER_SOL);
      const url = `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mintAddress}&amount=${lamports}&slippageBps=50`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();

        // Map decimals for display
        const decimalsMap: Record<string, number> = {
          SOL: 9,
          JUP: 6,
          WIF: 6,
          BONK: 5,
          RAY: 6,
          PYTH: 9,
          ORCA: 6,
          JTO: 9,
        };
        const tokenDecimals = decimalsMap[token.toUpperCase()] || 6;
        const outVal = parseInt(data.outAmount) / Math.pow(10, tokenDecimals);
        setExpectedOutput(outVal.toLocaleString(undefined, { maximumFractionDigits: 4 }));

        if (data.priceImpactPct) {
          setPriceImpact((parseFloat(data.priceImpactPct) * 100).toFixed(2) + '%');
        } else {
          setPriceImpact('0.00%');
        }
      } else {
        setExpectedOutput('Error fetching quote');
      }
    } catch (e) {
      console.error(e);
      setExpectedOutput('Unavailable');
    } finally {
      setQuoteLoading(false);
    }
  };

  // Auto fetch quote when tab changes or amount changes
  useEffect(() => {
    if (activeTab === 'swap' && mintAddress) {
      fetchQuote(swapAmount);
    }
  }, [activeTab, swapAmount, mintAddress]);

  // Execute Swap transaction with VCB Buyback & Burn Fee
  const executeSwap = async () => {
    if (!walletAddress || !mintAddress) return;
    setSwapTxStatus('building');
    setSwapTxError(null);
    setSwapTxSignature(null);

    const parsedAmount = parseFloat(swapAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setSwapTxError('Please enter a valid amount.');
      setSwapTxStatus('error');
      return;
    }

    try {
      const rpcEndpoint = import.meta.env.VITE_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
      const connection = new Connection(rpcEndpoint, 'confirmed');
      const fromPubkey = new PublicKey(walletAddress);
      const lamports = Math.round(parsedAmount * LAMPORTS_PER_SOL);
      const platformFeeLamports = Math.round(lamports * 0.001); // 0.1% platform fee

      const isDevnet = rpcEndpoint.includes('devnet') || rpcEndpoint.includes('testnet');
      const provider = (window as any).solana;
      if (!provider) {
        throw new Error('Phantom wallet provider not found in window.');
      }

      setSwapTxStatus('signing');

      // 1. Build and send platform fee transaction (burn-routing)
      const feeTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: new PublicKey('AxzTrEzTMCtaBhw32feEAWusofuDotg5toJJi9wCswrm'), // VCB Token Address
          lamports: platformFeeLamports > 0 ? platformFeeLamports : 5000,
        })
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      feeTx.recentBlockhash = latestBlockhash.blockhash;
      feeTx.feePayer = fromPubkey;

      const { signature: feeSig } = await provider.signAndSendTransaction(feeTx);
      setSwapTxSignature(feeSig);
      setSwapTxStatus('confirming');

      await connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: feeSig,
      }, 'confirmed');

      // 2. Swap execution (Mainnet real swap, Devnet simulated swap)
      if (isDevnet) {
        setSwapTxStatus('confirmed');
        if (onRefreshBalance) {
          onRefreshBalance();
        }
        return;
      }

      setSwapTxStatus('building');
      const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mintAddress}&amount=${lamports}&slippageBps=50`;
      const quoteRes = await fetch(quoteUrl).then((r) => r.json());

      const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quoteRes,
          userPublicKey: walletAddress,
          wrapAndUnwrapSol: true,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to create swap transaction from Jupiter');
        return r.json();
      });

      setSwapTxStatus('signing');
      const swapTransactionBuf = Buffer.from(swapRes.swapTransaction, 'base64');
      const swapTransaction = VersionedTransaction.deserialize(swapTransactionBuf);

      const { signature: swapSig } = await provider.signAndSendTransaction(swapTransaction);
      setSwapTxSignature(swapSig);
      setSwapTxStatus('confirming');

      await connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: swapSig,
      }, 'confirmed');

      setSwapTxStatus('confirmed');
      if (onRefreshBalance) {
        onRefreshBalance();
      }
    } catch (err: any) {
      console.error('Swap execution failed:', err);
      setSwapTxError(err.message || 'Swap transaction failed.');
      setSwapTxStatus('error');
    }
  };

  const handleRaidOnX = () => {
    let text = '';
    const score = verdict.score;
    const allocation = verdict.allocation;

    if (degenMode) {
      if (verdict.decision === 'GO') {
        text = `🚀 GIGA BULLISH: The AI Boardroom says 🐂 GO on $${token} (Score: ${score}/100, Allocation: ${allocation}). Dev is cooking and we are sending it! Ape in or hold the bag. #VCB #Solana #WAGMI @swarms_world`;
      } else if (verdict.decision === 'NO-GO') {
        text = `🐻 CRINGE JEETING SPOTTED: The AI Boardroom rejected $${token} (Score: ${score}/100). Liquidity risk is real, dev is ready to jeet. NGMI! #VCB #Solana @swarms_world`;
      } else {
        text = `🦀 MID COIN / HODL: The AI Boardroom is on 🦀 HOLD for $${token} (Score: ${score}/100). Looking for a better entry. Stay safe degens. #VCB #Solana @swarms_world`;
      }
    } else {
      if (verdict.decision === 'GO') {
        text = `🐂 VC BOARDROOM VERDICT: Approved 🐂 GO on $${token} (Composite Score: ${score}/100). Recommended allocation: ${allocation}. Read the full agentic analysis now. #VCB #Solana @swarms_world`;
      } else if (verdict.decision === 'NO-GO') {
        text = `🐻 VC BOARDROOM VERDICT: Passed 🐻 NO-GO on $${token} (Composite Score: ${score}/100) due to security risks. Review full report. #VCB #Solana @swarms_world`;
      } else {
        text = `🦀 VC BOARDROOM VERDICT: Neutral 🦀 HOLD on $${token} (Composite Score: ${score}/100) pending further market data. #VCB #Solana @swarms_world`;
      }
    }

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  };

  const decisionColor =
    verdict.decision === 'GO'
      ? 'var(--status-go)'
      : verdict.decision === 'NO-GO'
      ? 'var(--status-nogo)'
      : 'var(--status-hold)';

  const decisionEmoji =
    verdict.decision === 'GO' ? '🐂' : verdict.decision === 'NO-GO' ? '🐻' : '🦀';

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
      const rpcEndpoint = import.meta.env.VITE_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
      const connection = new Connection(rpcEndpoint, 'confirmed');
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
            {/* Tab Selector */}
            <div className="verdict-action-tabs">
              <button 
                className={`action-tab-btn ${activeTab === 'vault' ? 'active' : ''}`}
                onClick={() => setActiveTab('vault')}
              >
                🏛️ Vault Deposit
              </button>
              <button 
                className={`action-tab-btn ${activeTab === 'swap' ? 'active' : ''}`}
                onClick={() => setActiveTab('swap')}
              >
                🪐 Jupiter 1-Click Buy
              </button>
            </div>

            {activeTab === 'vault' ? (
              <div className="tab-pane-content">
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
                    <span className="spinner">🧠</span> Broadcasting transaction... Signature: 
                    <span className="signature-short"> {txSignature?.slice(0, 8)}...</span>
                  </div>
                )}

                {txStatus === 'confirmed' && txSignature && (
                  <div className="verdict-tx-success">
                    <span className="success-icon">🐂</span> 
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
                    <span className="error-icon">🐻</span> {txError}
                  </div>
                )}
              </div>
            ) : (
              <div className="tab-pane-content">
                <div className="verdict-action-title">🪐 JUPITER 1-CLICK SWAP (SOL ➔ ${token})</div>
                <p className="verdict-action-desc">
                  Swap SOL directly for ${token} using Jupiter V6 Liquidity Routing. 
                  A <strong>0.1% platform fee</strong> will be applied and routed to buy back and burn <strong>$VCB</strong> tokens.
                </p>

                {!walletAddress ? (
                  <div className="connected-address-warning">
                    🔑 Please connect your Phantom wallet in the header to execute this swap.
                  </div>
                ) : !mintAddress ? (
                  <div className="connected-address-warning">
                    🐻 Token contract address not found. Jupiter swap is unavailable for this asset.
                  </div>
                ) : (
                  <div className="verdict-action-form">
                    <div className="verdict-input-wrapper">
                      <label htmlFor="swap-amount">Pay (SOL)</label>
                      <input
                        id="swap-amount"
                        type="number"
                        step="0.001"
                        min="0.0001"
                        className="verdict-sol-input"
                        value={swapAmount}
                        onChange={(e) => setSwapAmount(e.target.value)}
                        disabled={swapTxStatus === 'building' || swapTxStatus === 'signing' || swapTxStatus === 'confirming'}
                      />
                    </div>

                    <div className="swap-details-box">
                      <div className="swap-detail-row">
                        <span>Receive (Est):</span>
                        <strong>{quoteLoading ? '🧠 Fetching...' : expectedOutput ? `${expectedOutput} ${token}` : '—'}</strong>
                      </div>
                      <div className="swap-detail-row">
                        <span>Price Impact:</span>
                        <span>{priceImpact || '—'}</span>
                      </div>
                      <div className="swap-detail-row">
                        <span>VCB Burn Fee:</span>
                        <span className="fee-highlight">{(parseFloat(swapAmount) * 0.001).toFixed(6)} SOL (0.1%)</span>
                      </div>
                    </div>

                    <button
                      className="verdict-submit-button swap-btn"
                      onClick={executeSwap}
                      disabled={quoteLoading || swapTxStatus === 'building' || swapTxStatus === 'signing' || swapTxStatus === 'confirming'}
                    >
                      {swapTxStatus === 'building' && 'Calculating Routes...'}
                      {swapTxStatus === 'signing' && 'Confirming in Wallet...'}
                      {swapTxStatus === 'confirming' && 'Confirming Burn & Swap...'}
                      {swapTxStatus === 'confirmed' && 'Swap Confirmed! ✓'}
                      {swapTxStatus === 'idle' && `Swap SOL for ${token}`}
                      {swapTxStatus === 'error' && 'Retry Swap'}
                    </button>
                  </div>
                )}

                {swapTxStatus === 'confirming' && (
                  <div className="verdict-tx-status loading">
                    <span className="spinner">🧠</span> Routing swap and burning VCB... Signature: 
                    <span className="signature-short"> {swapTxSignature?.slice(0, 8)}...</span>
                  </div>
                )}

                {swapTxStatus === 'confirmed' && swapTxSignature && (
                  <div className="verdict-tx-success">
                    <span className="success-icon">🚀</span> 
                    <div>
                      <strong>Swap & Burn Executed!</strong>
                      <br />
                      <p className="success-subtext">
                        Your swap succeeded. The 0.1% platform fee was transferred directly to the VCB Buyback & Burn Address.
                      </p>
                      <a
                        href={`https://solscan.io/tx/${swapTxSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="solscan-link"
                      >
                        View transaction on Solscan Explorer ↗
                      </a>
                      <div className="signature-full">Tx: {swapTxSignature}</div>
                    </div>
                  </div>
                )}

                {swapTxStatus === 'error' && swapTxError && (
                  <div className="verdict-tx-error">
                    <span className="error-icon">🐻</span> {swapTxError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Share & Raid Button */}
        <div className="verdict-share-box">
          <button className="raid-button" onClick={handleRaidOnX} title="Share the boardroom's verdict on X (Twitter)">
            <span className="x-logo">𝕏</span> Raid on X (Twitter)
          </button>
        </div>

        <div className="verdict-signatures">
          <div className="signature">
            <span className="sig-emoji">🛡️</span>
            <span className="sig-name">Security Auditor</span>
            <span className="sig-check">✓</span>
          </div>
          <div className="signature">
            <span className="sig-emoji">🧬</span>
            <span className="sig-name">The Quant</span>
            <span className="sig-check">✓</span>
          </div>
          <div className="signature">
            <span className="sig-emoji">📢</span>
            <span className="sig-name">Sentiment Analyst</span>
            <span className="sig-check">✓</span>
          </div>
          <div className="signature">
            <span className="sig-emoji">🐸</span>
            <span className="sig-name">Meme Strategist</span>
            <span className="sig-check">✓</span>
          </div>
          <div className="signature">
            <span className="sig-emoji">💼</span>
            <span className="sig-name">Lead Partner</span>
            <span className="sig-check sig-final">✓✓</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
