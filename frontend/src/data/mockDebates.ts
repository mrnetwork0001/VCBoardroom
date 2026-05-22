// ============================================
// Core Types & Agent Profiles Configuration
// ============================================

export interface AgentMessage {
  agent: 'security' | 'quant' | 'sentiment' | 'lead';
  content: string;
  timestamp: number;
  metrics?: Record<string, string | number>;
}

export interface DebateResult {
  token: string;
  messages: AgentMessage[];
  verdict: {
    decision: 'GO' | 'NO-GO' | 'HOLD';
    score: number;       // 0-100
    allocation: string;  // e.g. "2% of portfolio"
    rationale: string;
  };
}

export const AGENT_PROFILES = {
  security: {
    name: 'Security Auditor',
    title: 'Chief Security Officer',
    emoji: '🔒',
    color: 'var(--agent-security)',
    bgColor: 'var(--agent-security-bg)',
    glowColor: 'var(--agent-security-glow)',
    description: 'Smart contract audits, rug-pull detection, and risk assessment',
  },
  quant: {
    name: 'The Quant',
    title: 'Quantitative Analyst',
    emoji: '📊',
    color: 'var(--agent-quant)',
    bgColor: 'var(--agent-quant-bg)',
    glowColor: 'var(--agent-quant-glow)',
    description: 'Tokenomics, FDV analysis, on-chain metrics, and valuation models',
  },
  sentiment: {
    name: 'Sentiment Analyst',
    title: 'Narrative Strategist',
    emoji: '🐦',
    color: 'var(--agent-sentiment)',
    bgColor: 'var(--agent-sentiment-bg)',
    glowColor: 'var(--agent-sentiment-glow)',
    description: 'Social media sentiment, narrative tracking, and hype detection',
  },
  lead: {
    name: 'Lead Partner',
    title: 'Managing Director',
    emoji: '🏛️',
    color: 'var(--agent-lead)',
    bgColor: 'var(--agent-lead-bg)',
    glowColor: 'var(--agent-lead-glow)',
    description: 'Synthesis, final verdict, and portfolio allocation recommendation',
  },
} as const;

export type AgentType = keyof typeof AGENT_PROFILES;
