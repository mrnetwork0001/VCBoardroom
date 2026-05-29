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
import { Connection, PublicKey, Transaction, TransactionInstruction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Buffer } from 'buffer';
import './App.css';

const SOLANA_RPC_ENDPOINT = import.meta.env.VITE_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
const VCB_MINT_ADDRESS = import.meta.env.VITE_VCB_MINT || ''; // Configurable via VITE_VCB_MINT in .env

function App() {
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentType | null>(null);
  const [verdict, setVerdict] = useState<any | null>(null);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLanding, setShowLanding] = useState(true);

  // Real wallet states
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // VCB and Roast Mode States
  const [degenMode, setDegenMode] = useState(false);
  const [vcbBalance, setVcbBalance] = useState<number | null>(null);

  // Predict-to-Earn states
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [predictionToken, setPredictionToken] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] = useState<{
    correct: boolean;
    scoreDelta: number;
    newStreak: number;
    newPoints: number;
    oldPoints: number;
    wager?: number;
    wonAmount?: number;
    signature?: string | null;
  } | null>(null);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [betAmount, setBetAmount] = useState('100');
  const [betTxStatus, setBetTxStatus] = useState<'idle' | 'signing' | 'confirming' | 'confirmed' | 'error'>('idle');
  const [betTxError, setBetTxError] = useState<string | null>(null);
  const isSigningOrConfirming = betTxStatus === 'signing' || betTxStatus === 'confirming';
  const [leaderboardStats, setLeaderboardStats] = useState({
    points: 0,
    predictionsCount: 0,
    correctCount: 0,
    streak: 0,
    solWagered: 0,
    solWon: 0,
  });

  // Load leaderboard from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('vcb_leaderboard');
    if (stored) {
      try {
        setLeaderboardStats(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const entryIsUser = (entry: any) => {
    return entry.isUser;
  };

  const getLeaderboardList = (userPoints: number, userAddress: string | null) => {
    const userLabel = userAddress 
      ? `${userAddress.slice(0, 4)}...${userAddress.slice(-4)} (You)` 
      : 'You (Demo Wallet)';

    const baseList = [
      { name: '🐳 AlphaHunter (AI)', points: 5200, accuracy: '88%' },
      { name: '🦈 DegenBot (AI)', points: 4800, accuracy: '82%' },
      { name: '🐬 SolanaGigaChad', points: 3400, accuracy: '74%' },
      { name: 'PumpFunJeet', points: 1200, accuracy: '51%' },
      { name: 'PaperHands', points: 400, accuracy: '35%' },
    ];

    const userAccuracy = leaderboardStats.predictionsCount > 0 
      ? `${Math.round((leaderboardStats.correctCount / leaderboardStats.predictionsCount) * 100)}%`
      : '0%';
    
    const userEntry = {
      name: userLabel,
      points: userPoints,
      accuracy: userAccuracy,
      isUser: true,
    };

    const combinedList = [...baseList, userEntry];
    combinedList.sort((a, b) => b.points - a.points);

    return combinedList.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  };

  // Fetch real VCB balance on-chain if mint is set, otherwise default to 0 (blocking access by default)
  const fetchVcbBalance = useCallback(async (address: string) => {
    if (!VCB_MINT_ADDRESS) {
      setVcbBalance(0); // If no mint is configured, set to 0. Can be overridden in dev mode.
      return;
    }

    try {
      const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
      const ownerPublicKey = new PublicKey(address);
      const mintPublicKey = new PublicKey(VCB_MINT_ADDRESS);
      
      const response = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
        mint: mintPublicKey,
      });
      
      if (response.value.length > 0) {
        const tokenAccountInfo = response.value[0].account.data.parsed.info;
        const tokenAmount = tokenAccountInfo.tokenAmount.uiAmount || 0;
        setVcbBalance(tokenAmount);
      } else {
        setVcbBalance(0);
      }
    } catch (err) {
      console.error('Failed to fetch VCB balance from chain:', err);
      setVcbBalance(0);
    }
  }, [SOLANA_RPC_ENDPOINT]);

  // Toggle Degen/Roast Mode (gated by VCB token balance)
  const handleDegenModeToggle = useCallback(() => {
    if (!walletAddress) {
      alert("🛡️ Roast Mode is a premium feature! Please connect your Solana wallet to unlock it.");
      return;
    }
    if (vcbBalance === null || vcbBalance < 1000) {
      alert(`🐻 Access Denied: You hold ${vcbBalance || 0} $VCB tokens. You need at least 1,000 $VCB to unlock Roast Mode.`);
      return;
    }
    setDegenMode((prev) => !prev);
  }, [walletAddress, vcbBalance]);

  // Fetch balances when wallet connects/disconnects
  useEffect(() => {
    if (walletAddress) {
      fetchVcbBalance(walletAddress);
    } else {
      setVcbBalance(null);
      setDegenMode(false);
    }
  }, [walletAddress, fetchVcbBalance]);

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

  // Reset boardroom state
  const handleReset = useCallback(() => {
    setCurrentToken(null);
    setMessages([]);
    setVerdict(null);
    setActiveAgent(null);
    setErrorMessage(null);
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

  const handleStartAnalysis = useCallback((token: string) => {
    setPredictionToken(token.toUpperCase().replace('$', ''));
    setPredictionResult(null);
    setShowPredictionModal(true);
  }, []);

  const confirmPredictionAndAnalyze = useCallback(async (prediction: 'GO' | 'NO-GO' | null) => {
    if (!predictionToken) return;
    
    const parsedBet = parseFloat(betAmount);
    const isWager = prediction !== null;

    if (isWager) {
      if (!walletAddress) {
        alert("🔑 Wallet connection required to place an on-chain bet. Please connect your Phantom wallet.");
        return;
      }
      if (isNaN(parsedBet) || parsedBet <= 0) {
        alert("🐻 Invalid bet amount. Please enter a valid number of $VCB.");
        return;
      }
      if (vcbBalance !== null && vcbBalance < parsedBet) {
        alert(`🐻 Insufficient balance: You have ${vcbBalance} $VCB but tried to bet ${parsedBet} $VCB.`);
        return;
      }
    }

    setBetTxStatus('idle');
    setBetTxError(null);

    if (!isWager) {
      setShowPredictionModal(false);
    }

    let wagerConfirmed = false;
    let betSignature: string | null = null;

    if (isWager) {
      setBetTxStatus('signing');
      try {
        const rpcEndpoint = import.meta.env.VITE_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcEndpoint, 'confirmed');
        const fromPubkey = new PublicKey(walletAddress!);
        
        // 1. Get Decimals from the VCB Mint Address (or fallback to 9)
        const isDevnet = rpcEndpoint.includes('devnet') || rpcEndpoint.includes('testnet');
        let decimals = 9;
        
        if (VCB_MINT_ADDRESS) {
          try {
            const mintPublicKey = new PublicKey(VCB_MINT_ADDRESS);
            const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);
            if (mintInfo?.value?.data && typeof mintInfo.value.data === 'object' && 'parsed' in mintInfo.value.data) {
              decimals = (mintInfo.value.data as any).parsed.info.decimals ?? 9;
            }
          } catch (mintErr) {
            console.error('Failed to parse mint decimals, defaulting to 9:', mintErr);
          }
        }

        const rawAmount = Math.round(parsedBet * Math.pow(10, decimals));

        // 2. Derive ATA Accounts
        const mintPublicKey = new PublicKey(VCB_MINT_ADDRESS || "AxzTrEzTMCtaBhw32feEAWusofuDotg5toJJi9wCswrm");
        
        const userATA = PublicKey.findProgramAddressSync(
          [fromPubkey.toBuffer(), new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(), mintPublicKey.toBuffer()],
          new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
        )[0];

        // Treasury Owner: default to user ATA if devnet to guarantee success without prior setup, otherwise use standard treasury wallet
        const treasuryOwner = isDevnet 
          ? fromPubkey 
          : new PublicKey("7xKX1n8CuhWdM25q2uE3b3vD7A7g8k8qGq6Wn9k11111");
        
        const treasuryATA = isDevnet 
          ? userATA 
          : PublicKey.findProgramAddressSync(
              [treasuryOwner.toBuffer(), new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(), mintPublicKey.toBuffer()],
              new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
            )[0];

        // 3. Build instruction data manually to avoid TS BigInt issue
        const data = Buffer.alloc(9);
        data.writeUInt8(3, 0); // 3 = Transfer
        
        let temp = rawAmount;
        for (let i = 1; i <= 8; i++) {
          data[i] = temp & 0xff;
          temp = Math.floor(temp / 256);
        }

        const transferInstruction = new TransactionInstruction({
          keys: [
            { pubkey: userATA, isSigner: false, isWritable: true },
            { pubkey: treasuryATA, isSigner: false, isWritable: true },
            { pubkey: fromPubkey, isSigner: true, isWritable: false },
          ],
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          data,
        });

        const transaction = new Transaction().add(transferInstruction);

        const latestBlockhash = await connection.getLatestBlockhash();
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = fromPubkey;

        const provider = (window as any).solana;
        if (!provider) {
          throw new Error('Phantom wallet provider not found.');
        }

        const { signature } = await provider.signAndSendTransaction(transaction);
        betSignature = signature;
        setBetTxStatus('confirming');

        await connection.confirmTransaction({
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          signature,
        }, 'confirmed');

        setBetTxStatus('confirmed');
        wagerConfirmed = true;
        setShowPredictionModal(false);
        
        // Refresh wallet balance
        fetchVcbBalance(walletAddress!);
      } catch (err: any) {
        console.error('Bet transaction failed:', err);
        setBetTxError(err.message || 'Transaction was rejected or failed.');
        setBetTxStatus('error');
        return;
      }
    }

    const token = predictionToken;
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
        degenMode,
      );

      setActiveAgent(null);
      setIsAnalyzing(false);
      setVerdict(result.verdict);
      setAnalysisCount((c) => c + 1);

      if (isWager && wagerConfirmed) {
        const isCorrect = (prediction === 'GO' && result.verdict.decision === 'GO') || 
                          (prediction === 'NO-GO' && result.verdict.decision !== 'GO');
        
        const storedLeaderboard = localStorage.getItem('vcb_leaderboard');
        let leaderboardData = storedLeaderboard ? JSON.parse(storedLeaderboard) : {
          points: 0,
          predictionsCount: 0,
          correctCount: 0,
          streak: 0,
          solWagered: 0,
          solWon: 0,
        };

        const oldPoints = leaderboardData.points || 0;
        leaderboardData.predictionsCount += 1;
        leaderboardData.solWagered = (leaderboardData.solWagered || 0) + parsedBet;

        let scoreDelta = 0;
        let wonAmount = 0;

        if (isCorrect) {
          leaderboardData.correctCount += 1;
          leaderboardData.streak += 1;
          scoreDelta = 100 + 50 * (leaderboardData.streak - 1);
          leaderboardData.points += scoreDelta;
          
          // Winnings: 1.9x payout
          wonAmount = parsedBet * 1.9;
          leaderboardData.solWon = (leaderboardData.solWon || 0) + wonAmount;
        } else {
          leaderboardData.streak = 0;
        }

        localStorage.setItem('vcb_leaderboard', JSON.stringify(leaderboardData));
        setLeaderboardStats(leaderboardData);
        
        setPredictionResult({
          correct: isCorrect,
          scoreDelta,
          newStreak: leaderboardData.streak,
          newPoints: leaderboardData.points,
          oldPoints,
          wager: parsedBet,
          wonAmount,
          signature: betSignature,
        });
      }
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setIsAnalyzing(false);
      setActiveAgent(null);
      setErrorMessage(err.message || 'Analysis failed. Please check if the AI backend is online.');
    }
  }, [predictionToken, degenMode, betAmount, walletAddress, fetchVcbBalance, vcbBalance]);

  return (
    <div className="app">
      {/* Background grid effect */}
      <div className="bg-grid" />

      {/* Massive Bleeding Background Watermarks */}
      <div className="bg-watermark" style={{ top: '15%', left: '-5%', transform: 'rotate(-8deg)', zIndex: 0 }}>VCB</div>
      <div className="bg-watermark" style={{ bottom: '20%', right: '-5%', transform: 'rotate(6deg)', color: 'rgba(0, 245, 212, 0.025)', zIndex: 0 }}>SWARMS</div>

      {/* Floating Dopamine Accent Shapes */}
      <div className="floating-decor" style={{ top: '8%', left: '4%', fontSize: '48px' }}>🐂</div>
      <div className="floating-decor" style={{ top: '28%', right: '6%', fontSize: '32px' }}>💸</div>
      <div className="floating-decor" style={{ top: '55%', left: '2%', fontSize: '40px' }}>🐋</div>
      <div className="floating-decor" style={{ top: '78%', right: '8%', fontSize: '48px' }}>📈</div>
      <div className="floating-decor" style={{ top: '88%', left: '5%', fontSize: '36px' }}>🦀</div>

      {/* Header */}
      <header className="app-header">
        <div className="header-left" onClick={() => setShowLanding(true)} style={{ cursor: 'pointer' }} title="Go to landing page">
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
              {backendStatus === 'online' ? '🧠 LIVE AI' : backendStatus === 'checking' ? '🧠 Checking...' : '🐻 OFFLINE'}
            </span>
          </div>

          {/* Roast Mode Toggle */}
          {!showLanding && (
            <div 
              className={`roast-mode-toggle ${degenMode ? 'active' : ''}`} 
              onClick={handleDegenModeToggle}
              title={
                !walletAddress 
                  ? "Connect wallet to unlock Roast Mode (Premium)" 
                  : (vcbBalance !== null && vcbBalance < 1000)
                  ? `Insufficient VCB (${vcbBalance}/1000).`
                  : "Click to toggle Roast Mode"
              }
            >
              <span className="fire-emoji">🌶️</span>
              <span className="roast-text">
                {degenMode ? 'ROAST MODE ON' : 'Roast Mode'}
              </span>
              {vcbBalance !== null && (
                <span className="vcb-badge">
                  {vcbBalance} $VCB
                </span>
              )}
            </div>
          )}

          {!showLanding && (
            <div className="nav-links">
              <button className="nav-btn" onClick={() => setShowLanding(true)}>
                Home
              </button>
            </div>
          )}

          {!showLanding && (
            <div className="stats-badges">
              <div className="stat-badge interactive" onClick={() => setShowLeaderboardModal(true)} title="View Predict-to-Earn Leaderboard">
                <span className="stat-badge-value">🐳</span>
                <span className="stat-badge-label">Leaderboard</span>
              </div>
              <div className="stat-badge">
                <span className="stat-badge-value">{analysisCount}</span>
                <span className="stat-badge-label">Analyses</span>
              </div>
              <div className="stat-badge">
                <span className="stat-badge-value">5</span>
                <span className="stat-badge-label">Agents</span>
              </div>
            </div>
          )}

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
        {showLanding ? (
          <div className="landing-page">
            {/* Hero Section */}
            <section className="landing-hero">
              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="hero-container"
              >
                <div className="hero-badge">💼 Autonomous VC Fund Agents</div>
                <h1 className="hero-title">
                  Convene Your Multi-Agent <br />
                  <span className="gradient-text">Investment Committee</span>
                </h1>
                <p className="hero-desc">
                  Leverage the power of specialized Swarms AI agents. Our security, quant, and narrative experts debate the investment thesis of any Solana token in real-time, delivering a synthesized institutional verdict.
                </p>
                <div className="hero-actions">
                  <button className="primary-cta" onClick={() => setShowLanding(false)}>
                    Convene Boardroom →
                  </button>
                  <a 
                    href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=AxzTrEzTMCtaBhw32feEAWusofuDotg5toJJi9wCswrm" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="secondary-cta"
                  >
                    Get $VCB Token
                  </a>
                </div>
              </motion.div>
            </section>

            {/* AI Agents Committee Section */}
            <section className="landing-section agents-section">
              <h2 className="section-title">Meet the Investment Committee</h2>
              <p className="section-subtitle">Five autonomous Swarms agents collaborating to evaluate every angle of a project.</p>
              
              <div className="agents-grid">
                <div className="agent-landing-card">
                  <div className="agent-landing-icon">🛡️</div>
                  <h3>Security Auditor</h3>
                  <span className="agent-landing-title">Chief Security Officer</span>
                  <p>Analyzes smart contract code safety, mint/freeze authorities, centralization vectors, and rug-pull risks.</p>
                </div>
                
                <div className="agent-landing-card">
                  <div className="agent-landing-icon">🧬</div>
                  <h3>The Quant</h3>
                  <span className="agent-landing-title">Quantitative Analyst</span>
                  <p>Evaluates circulating-to-FDV ratios, mathematical tokenomics models, active address velocity, and comparable valuations.</p>
                </div>
                
                <div className="agent-landing-card">
                  <div className="agent-landing-icon">📢</div>
                  <h3>Sentiment Analyst</h3>
                  <span className="agent-landing-title">Narrative Strategist</span>
                  <p>Scans X (Twitter) and Telegram to measure community health, organic hype, raid volumes, and detect bot shill activity.</p>
                </div>

                <div className="agent-landing-card">
                  <div className="agent-landing-icon">🐸</div>
                  <h3>Meme Strategist</h3>
                  <span className="agent-landing-title">Cultural Resonance Expert</span>
                  <p>Evaluates cultural appeal, ticker resonance, mascot virality, and organic raiding potential to gauge retail mindshare.</p>
                </div>
                
                <div className="agent-landing-card">
                  <div className="agent-landing-icon">💼</div>
                  <h3>Lead Partner</h3>
                  <span className="agent-landing-title">Managing Director</span>
                  <p>Synthesizes all analyst findings into a unified conviction thesis, delivering a final GO/NO-GO verdict and allocation ratio.</p>
                </div>
              </div>
            </section>

            {/* VCB Tokenomics Section */}
            <section className="landing-section tokenomics-section">
              <div className="tokenomics-container">
                <div className="tokenomics-content">
                  <h2 className="section-title">The $VCB Ecosystem</h2>
                  <p className="tokenomics-desc">
                    The `$VCB` token powers the Virtual VC Boardroom, translating AI intelligence into decentralized coordination and holder utility.
                  </p>
                  <ul className="utility-list">
                    <li>
                      <span className="utility-icon">🌶️</span>
                      <div>
                        <strong>Roast & Degen Mode Gated</strong>
                        <p>Hold at least 1,000 $VCB to unlock Roast Mode, allowing you to run raw, uncensored CT-slang analyses.</p>
                      </div>
                    </li>
                    <li>
                      <span className="utility-icon">⚖️</span>
                      <div>
                        <strong>Treasury Governance</strong>
                        <p>Stake $VCB to participate in DAO investment proposals, voting on real-world trades executed by the committee.</p>
                      </div>
                    </li>
                    <li>
                      <span className="utility-icon">🚀</span>
                      <div>
                        <strong>Priority Scanning</strong>
                        <p>Blink-enabled queue prioritization by paying micro-tips in $VCB to audit new tokens instantly.</p>
                      </div>
                    </li>
                  </ul>
                </div>
                <div className="tokenomics-visual">
                  <div className="tokenomics-glass-panel">
                    <div className="visual-header">
                      <span className="badge-glow">Token Utility Status</span>
                    </div>
                    <div className="utility-status-item">
                      <span>Connected Wallet:</span>
                      <strong className={walletAddress ? 'text-success' : 'text-warning'}>
                        {walletAddress ? 'CONNECTED' : 'DISCONNECTED'}
                      </strong>
                    </div>
                    <div className="utility-status-item">
                      <span>VCB Balance:</span>
                      <strong className="balance-highlight">{vcbBalance !== null ? `${vcbBalance} $VCB` : '0 $VCB'}</strong>
                    </div>
                    <div className="utility-status-item">
                      <span>Roast Mode Access:</span>
                      <strong className={(vcbBalance !== null && vcbBalance >= 1000) ? 'text-success' : 'text-danger'}>
                        {(vcbBalance !== null && vcbBalance >= 1000) ? 'UNLOCKED' : 'LOCKED (Requires 1000 VCB)'}
                      </strong>
                    </div>
                    {!walletAddress ? (
                      <button className="connect-action-btn" onClick={connectWallet}>
                        Connect Wallet to Check Access
                      </button>
                    ) : (
                      <button className="convene-action-btn" onClick={() => setShowLanding(false)}>
                        Enter the Boardroom
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <>
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
                  Five AI agents: Security Auditor, Quant, Sentiment Analyst, Meme Strategist, and Lead Partner - will debate the investment thesis of any token in real-time.
                </p>
              </motion.div>

              {backendStatus === 'offline' && (
                <div className="backend-offline-banner">
                  <span className="warning-icon">🚨</span>
                  <div>
                    <strong>AI Engine Offline:</strong> Could not connect to the Swarms backend. 
                    Please start the backend server by running <code>python main.py</code> inside the <code>backend</code> directory to perform analysis.
                  </div>
                </div>
              )}

              <TokenInput 
                onSubmit={handleStartAnalysis} 
                onReset={handleReset}
                isAnalyzing={isAnalyzing} 
                hasResult={!!currentToken || messages.length > 0}
              />
            </section>

            {/* Error Message */}
            {errorMessage && (
              <section className="error-section">
                <div className="error-banner">
                  <span className="error-icon">🐻</span>
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
                        degenMode={degenMode}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}
          </>
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

      {/* Prediction Modal */}
      <AnimatePresence>
        {showPredictionModal && predictionToken && (
          <div className="modal-overlay">
            <motion.div 
              className="modal-content prediction-modal glass-strong"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="modal-header">
                <h2>📈 Predict & Bet $VCB</h2>
                <p className="modal-subtitle">Will the board approve or reject ${predictionToken}?</p>
                <button 
                  className="close-modal-btn" 
                  disabled={isSigningOrConfirming}
                  onClick={() => {
                    setShowPredictionModal(false);
                    setBetTxStatus('idle');
                    setBetTxError(null);
                  }}
                >
                  ×
                </button>
              </div>

              {/* Bet Amount Input */}
              <div className="prediction-bet-input-wrapper" style={{ marginBottom: '20px' }}>
                <label htmlFor="modal-bet-amount" style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Bet Size ($VCB)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    id="modal-bet-amount"
                    type="number"
                    min="10"
                    step="10"
                    disabled={isSigningOrConfirming}
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '16px', fontFamily: 'var(--font-mono)', width: '120px', outline: 'none', opacity: isSigningOrConfirming ? 0.6 : 1 }}
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Payout (1.9x): <strong style={{ color: 'var(--status-go)' }}>{isNaN(parseFloat(betAmount)) ? '0' : Math.round(parseFloat(betAmount) * 1.9)} $VCB</strong>
                  </span>
                </div>
                {vcbBalance !== null && (
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                    Available Balance: <strong style={{ color: 'var(--accent-primary)' }}>{vcbBalance} $VCB</strong>
                  </p>
                )}
              </div>

              {/* Transaction Status Box */}
              {betTxStatus !== 'idle' && betTxStatus !== 'confirmed' && (
                <div style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  alignItems: 'center',
                  textAlign: 'center'
                }}>
                  {betTxStatus === 'signing' && (
                    <>
                      <div className="bet-spinner" style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: '2px solid rgba(168, 85, 247, 0.2)',
                        borderTopColor: 'var(--accent-primary)',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '4px'
                      }} />
                      <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Approve Bet in Wallet</strong>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>Please approve the transaction in your Phantom wallet.</p>
                    </>
                  )}
                  {betTxStatus === 'confirming' && (
                    <>
                      <div className="bet-spinner" style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: '2px solid rgba(52, 211, 153, 0.2)',
                        borderTopColor: 'var(--status-go)',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '4px'
                      }} />
                      <strong style={{ color: 'var(--status-go)', fontSize: '14px' }}>Confirming Bet...</strong>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>Waiting for Solana network confirmation...</p>
                    </>
                  )}
                  {betTxStatus === 'error' && (
                    <>
                      <span style={{ fontSize: '24px', marginBottom: '4px' }}>🐻</span>
                      <strong style={{ color: 'var(--status-nogo)', fontSize: '14px' }}>Bet Failed</strong>
                      <p style={{ color: 'var(--status-nogo)', fontSize: '12px', margin: 0 }}>{betTxError || 'Transaction rejected or failed.'}</p>
                    </>
                  )}
                </div>
              )}
              
              <div className="prediction-options">
                <button 
                  className="predict-btn go"
                  disabled={isSigningOrConfirming}
                  style={{ opacity: isSigningOrConfirming ? 0.6 : 1 }}
                  onClick={() => confirmPredictionAndAnalyze('GO')}
                >
                  <span className="btn-icon">🐂</span>
                  <span className="btn-title">Bet & Predict GO</span>
                  <span className="btn-desc">Approve token for investment</span>
                </button>
 
                <button 
                  className="predict-btn nogo"
                  disabled={isSigningOrConfirming}
                  style={{ opacity: isSigningOrConfirming ? 0.6 : 1 }}
                  onClick={() => confirmPredictionAndAnalyze('NO-GO')}
                >
                  <span className="btn-icon">🐻</span>
                  <span className="btn-title">Bet & Predict NO-GO</span>
                  <span className="btn-desc">Reject or hold token</span>
                </button>
              </div>

              <div className="modal-footer">
                <button 
                  className="skip-btn"
                  disabled={isSigningOrConfirming}
                  style={{ opacity: isSigningOrConfirming ? 0.5 : 1, cursor: isSigningOrConfirming ? 'not-allowed' : 'pointer' }}
                  onClick={() => confirmPredictionAndAnalyze(null)}
                >
                  Skip Prediction & Convene Boardroom
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboardModal && (
          <div className="modal-overlay" onClick={() => setShowLeaderboardModal(false)}>
            <motion.div 
              className="modal-content leaderboard-modal glass-strong"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>🐳 Predict-to-Earn Leaderboard</h2>
                <p className="modal-subtitle">Human vs. AI Investment Accuracy</p>
                <button className="close-modal-btn" onClick={() => setShowLeaderboardModal(false)}>×</button>
              </div>

              {/* Player Stats Summary */}
              <div className="leaderboard-summary">
                <div className="summary-card">
                  <span className="card-label">Rank</span>
                  <span className="card-value">
                    #{
                      getLeaderboardList(leaderboardStats.points, walletAddress)
                        .find(e => entryIsUser(e))?.rank || '—'
                    }
                  </span>
                </div>
                <div className="summary-card">
                  <span className="card-label">Points</span>
                  <span className="card-value">{leaderboardStats.points}</span>
                </div>
                <div className="summary-card">
                  <span className="card-label">Accuracy</span>
                  <span className="card-value">
                    {leaderboardStats.predictionsCount > 0 
                      ? `${Math.round((leaderboardStats.correctCount / leaderboardStats.predictionsCount) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="summary-card">
                  <span className="card-label">Streak</span>
                  <span className="card-value">🔥 {leaderboardStats.streak}</span>
                </div>
                <div className="summary-card">
                  <span className="card-label">VCB Wagered</span>
                  <span className="card-value">{leaderboardStats.solWagered || 0}</span>
                </div>
                <div className="summary-card">
                  <span className="card-label">VCB Won</span>
                  <span className="card-value" style={{ color: 'var(--status-go)' }}>
                    {Math.round(leaderboardStats.solWon || 0)}
                  </span>
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="leaderboard-table-container">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Participant</th>
                      <th>Accuracy</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getLeaderboardList(leaderboardStats.points, walletAddress).map((player) => {
                      const isUser = entryIsUser(player);
                      return (
                        <tr key={player.name} className={isUser ? 'user-row' : ''}>
                          <td className="rank-cell">
                            {player.rank === 1 ? '🐳' : player.rank === 2 ? '🦈' : player.rank === 3 ? '🐬' : `#${player.rank}`}
                          </td>
                          <td className="name-cell">{player.name}</td>
                          <td className="accuracy-cell">{player.accuracy}</td>
                          <td className="points-cell">{player.points.toLocaleString()} PTS</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Prediction Result Popup */}
      <AnimatePresence>
        {predictionResult && (
          <motion.div 
            className="prediction-result-popup glass-strong"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
          >
            <div className="popup-header">
              {predictionResult.correct ? (
                <span className="success-badge">🚀 prediction correct!</span>
              ) : (
                <span className="fail-badge">📉 prediction incorrect</span>
              )}
              <button className="close-popup-btn" onClick={() => setPredictionResult(null)}>×</button>
            </div>
            <div className="popup-body">
              {predictionResult.correct ? (
                <p>
                  You successfully predicted the Boardroom's verdict for <strong>${currentToken}</strong>! 
                  Earned <span className="pts-highlight">+{predictionResult.scoreDelta} PTS</span> and{' '}
                  <strong style={{ color: 'var(--status-go)' }}>{Math.round(predictionResult.wonAmount || 0)} $VCB</strong> (1.9x payout).
                </p>
              ) : (
                <p>
                  The Boardroom decided differently for <strong>${currentToken}</strong>. Your bet of <strong>{predictionResult.wager} $VCB</strong> has been routed to the burn treasury.
                </p>
              )}

              {predictionResult.signature && (
                <a
                  href={`https://solscan.io/tx/${predictionResult.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="solscan-link"
                  style={{ fontSize: '11px', margin: '4px 0', display: 'block' }}
                >
                  View Bet Transaction ↗
                </a>
              )}

              <div className="popup-stats" style={{ marginTop: '10px' }}>
                <div className="popup-stat-item">
                  <span className="stat-lbl">Total Score</span>
                  <span className="stat-val">{predictionResult.newPoints} PTS</span>
                </div>
                <div className="popup-stat-item">
                  <span className="stat-lbl">Win Streak</span>
                  <span className="stat-val">🌶️ {predictionResult.newStreak}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
