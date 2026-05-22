import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TokenInput from './components/TokenInput';
import BoardroomTable from './components/BoardroomTable';
import DebatePanel from './components/DebatePanel';
import VerdictCard from './components/VerdictCard';
import {
  type AgentType,
  type AgentMessage,
} from './data/mockDebates';
import { runAnalysis as apiRunAnalysis, checkBackendHealth } from './utils/apiClient';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import './App.css';

const SOLANA_RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

function App() {
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentType | null>(null);
  const [verdict, setVerdict] = useState<any | null>(null);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real wallet states
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Fetch real Solana balance
  const fetchWalletBalance = useCallback(async (address: string) => {
    try {
      const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
      const balance = await connection.getBalance(new PublicKey(address));
      setWalletBalance(balance / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Failed to fetch Solana balance:', err);
      setWalletBalance(null);
    }
  }, []);

  // Connect Phantom Wallet
  const connectWallet = useCallback(async () => {
    const provider = (window as any).solana;
    if (!provider) {
      alert('Phantom wallet not found! Please install the Phantom extension from https://phantom.app');
      return;
    }
    try {
      const resp = await provider.connect();
      const pubKey = resp.publicKey.toString();
      setWalletAddress(pubKey);
      fetchWalletBalance(pubKey);
    } catch (err) {
      console.error('Failed to connect wallet:', err);
    }
  }, [fetchWalletBalance]);

  // Disconnect Phantom Wallet
  const disconnectWallet = useCallback(async () => {
    const provider = (window as any).solana;
    if (provider) {
      try {
        await provider.disconnect();
      } catch (err) {
        console.error('Failed to disconnect wallet:', err);
      }
    }
    setWalletAddress(null);
    setWalletBalance(null);
  }, []);

  // Check backend status on mount & eagerly connect wallet if trusted
  useEffect(() => {
    checkBackendHealth().then((up) => {
      setBackendStatus(up ? 'online' : 'offline');
    });

    const provider = (window as any).solana;
    if (provider && provider.isPhantom) {
      provider.connect({ onlyIfTrusted: true })
        .then((resp: any) => {
          const pubKey = resp.publicKey.toString();
          setWalletAddress(pubKey);
          fetchWalletBalance(pubKey);
        })
        .catch(() => {
          // Normal: user has not connected yet
        });
    }
  }, [fetchWalletBalance]);

  const runAnalysis = useCallback(async (token: string) => {
    setCurrentToken(token);
    setIsAnalyzing(true);
    setMessages([]);
    setVerdict(null);
    setActiveAgent(null);
    setErrorMessage(null);

    try {
      const result = await apiRunAnalysis(
        token,
        (agent) => setActiveAgent(agent),
        (message) => setMessages((prev) => [...prev, message]),
      );

      setActiveAgent(null);
      setIsAnalyzing(false);
      setVerdict(result.verdict);
      setAnalysisCount((c) => c + 1);
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setIsAnalyzing(false);
      setActiveAgent(null);
      setErrorMessage(err.message || 'Analysis failed. Please check if the AI backend is online.');
    }
  }, []);

  return (
    <div className="app">
      {/* Background grid effect */}
      <div className="bg-grid" />

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">🏛️</span>
            <div>
              <h1 className="logo-text">Virtual VC Boardroom</h1>
              <p className="logo-tagline">Multi-Agent Investment Intelligence</p>
            </div>
          </div>
        </div>
        <div className="header-right">
          {/* Backend Status Indicator */}
          <div className={`backend-status ${backendStatus}`} title={
            backendStatus === 'online'
              ? 'Connected to live AI backend — real Swarms agents active'
              : backendStatus === 'checking'
              ? 'Checking backend connection...'
              : 'Backend offline — live AI analysis unavailable. Run python main.py to start.'
          }>
            <span className={`status-dot ${backendStatus}`} />
            <span className="status-text">
              {backendStatus === 'online' ? '🤖 LIVE AI' : backendStatus === 'checking' ? '⏳ Checking...' : '❌ OFFLINE'}
            </span>
          </div>

          <div className="stats-badges">
            <div className="stat-badge">
              <span className="stat-badge-value">{analysisCount}</span>
              <span className="stat-badge-label">Analyses</span>
            </div>
            <div className="stat-badge">
              <span className="stat-badge-value">4</span>
              <span className="stat-badge-label">Agents</span>
            </div>
          </div>

          {/* Real Wallet Connect Button */}
          {walletAddress ? (
            <button className="wallet-button connected" onClick={disconnectWallet} title="Click to disconnect">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M2 10h20" />
              </svg>
              {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)} 
              {walletBalance !== null ? ` (${walletBalance.toFixed(3)} SOL)` : ''}
            </button>
          ) : (
            <button className="wallet-button" onClick={connectWallet}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M2 10h20" />
              </svg>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Token Input */}
        <section className="input-section">
          <motion.div
            className="hero-text"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2>Convene Your Investment Committee</h2>
            <p>
              Four AI agents — Security Auditor, Quant, Sentiment Analyst, and Lead Partner
              — will debate the investment thesis of any token in real-time.
            </p>
          </motion.div>

          {backendStatus === 'offline' && (
            <div className="backend-offline-banner">
              <span className="warning-icon">⚠️</span>
              <div>
                <strong>AI Engine Offline:</strong> Could not connect to the Swarms backend. 
                Please start the backend server by running <code>python main.py</code> inside the <code>backend</code> directory to perform analysis.
              </div>
            </div>
          )}

          <TokenInput 
            onSubmit={runAnalysis} 
            isAnalyzing={isAnalyzing} 
          />
        </section>

        {/* Error Message */}
        {errorMessage && (
          <section className="error-section">
            <div className="error-banner">
              <span className="error-icon">❌</span>
              <p>{errorMessage}</p>
            </div>
          </section>
        )}

        {/* Analysis Workspace */}
        {(currentToken || messages.length > 0) && (
          <motion.section
            className="workspace"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="workspace-grid">
              {/* Left: Boardroom Visualization */}
              <div className="workspace-left">
                <BoardroomTable
                  activeAgent={activeAgent}
                  analyzedToken={currentToken}
                />
              </div>

              {/* Right: Debate Transcript */}
              <div className="workspace-right">
                <DebatePanel messages={messages} activeAgent={activeAgent} />
              </div>
            </div>

            {/* Verdict */}
            <AnimatePresence>
              {verdict && currentToken && (
                <motion.div
                  className="verdict-section"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <VerdictCard 
                    verdict={verdict} 
                    token={currentToken} 
                    walletAddress={walletAddress}
                    onRefreshBalance={walletAddress ? () => fetchWalletBalance(walletAddress) : undefined}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <span className="footer-brand">
            Built with <span className="footer-heart">♥</span> using{' '}
            <a href="https://swarms.world" target="_blank" rel="noopener noreferrer">
              Swarms Framework
            </a>
          </span>
          <span className="footer-chain">
            Powered by <strong>Solana</strong> • ACM Hackathon 2026
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
