import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AGENT_PROFILES, type AgentType, type AgentMessage } from '../data/mockDebates';
import './DebatePanel.css';

interface DebatePanelProps {
  messages: AgentMessage[];
  activeAgent: AgentType | null;
}

// Fallback cleaner for agent content to remove prepended queries/market briefings
function cleanAgentContent(content: string, _agentId?: string): string {
  let clean = content.trim();
  
  // 1. Remove prompt text prepended by Swarms
  if (clean.toLowerCase().includes("analyze the cryptocurrency token:")) {
    const marketDataEndIndex = clean.indexOf("=== END OF MARKET DATA ===");
    if (marketDataEndIndex !== -1) {
      const remaining = clean.slice(marketDataEndIndex + "=== END OF MARKET DATA ===".length).trim();
      const lines = remaining.split('\n');
      if (lines.length > 0 && (lines[0].toLowerCase().includes("use the real numbers") || lines[0].toLowerCase().includes("do not make up"))) {
        clean = lines.slice(1).join('\n').trim();
      } else {
        clean = remaining;
      }
    }
  }
  
  // 2. Remove Lead Partner synthesis prompt repeating
  if (clean.toLowerCase().includes("you are reviewing investment reports")) {
    const finalVerdictIndex = clean.toLowerCase().indexOf("deliver your final investment verdict.");
    if (finalVerdictIndex !== -1) {
      const remaining = clean.slice(finalVerdictIndex + "deliver your final investment verdict.".length).trim();
      clean = remaining;
    }
  }
  
  return clean;
}

// Extract quick stats for the summary badges
function extractQuickStats(content: string, agentId: string) {
  const stats: { badge: string; status: 'go' | 'no-go' | 'hold' | 'neutral' } = { 
    badge: '', 
    status: 'neutral' 
  };
  
  if (!content) return stats;
  
  if (agentId === 'security') {
    const match = content.match(/Risk\s*Score:\s*(\d+)\/(\d+)/i);
    if (match) {
      const score = parseInt(match[1]);
      stats.badge = `Risk Score: ${score}/10`;
      stats.status = score >= 8 ? 'go' : score >= 6 ? 'hold' : 'no-go';
    } else {
      stats.badge = 'Security Evaluated';
    }
  } else if (agentId === 'quant') {
    const match = content.match(/Fair\s*Value\s*(?:Estimate)?:\s*(?:around\s*)?(\$[0-9.,]+)/i);
    if (match) {
      stats.badge = `Fair Value: ${match[1]}`;
      stats.status = 'neutral';
    } else {
      stats.badge = 'Valuation Completed';
    }
  } else if (agentId === 'sentiment') {
    const match = content.match(/Hype\/Substance\s*(?:Score)?:\s*(\d+)\/(\d+)/i);
    if (match) {
      const score = parseInt(match[1]);
      stats.badge = `Hype: ${score}/100`;
      stats.status = score >= 75 ? 'go' : score >= 50 ? 'hold' : 'no-go';
    } else {
      stats.badge = 'Sentiment Tracked';
    }
  } else if (agentId === 'lead') {
    const verdictMatch = content.match(/Verdict:\s*(?:🟢\s*|🔴\s*|🟡\s*)?(GO|NO-GO|HOLD)/i);
    const scoreMatch = content.match(/Composite\s*Score:\s*(\d+)\/(\d+)/i);
    if (verdictMatch) {
      const v = verdictMatch[1].toUpperCase();
      stats.badge = `Verdict: ${v}`;
      if (scoreMatch) {
        stats.badge += ` (${scoreMatch[1]}/100)`;
      }
      stats.status = v === 'GO' ? 'go' : v === 'HOLD' ? 'hold' : 'no-go';
    } else {
      stats.badge = 'Verdict Ready';
    }
  }
  
  return stats;
}

// Plain text snippet for the card body preview
function getSnippet(text: string) {
  let plain = text
    .replace(/[#*|]/g, '') // remove markdown symbols
    .replace(/\s+/g, ' ')  // normalize whitespace
    .trim();
  if (plain.length > 130) {
    return plain.slice(0, 130) + '...';
  }
  return plain;
}

// Lightweight native markdown renderer
function parseMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  
  const flushList = (key: string | number) => {
    if (inList && listItems.length > 0) {
      elements.push(<ul key={`list-${key}`} className="report-list">{listItems}</ul>);
      listItems = [];
      inList = false;
    }
  };
  
  const flushTable = (key: string | number) => {
    if (inTable && tableRows.length > 0) {
      const headers = tableRows[0];
      const rows = tableRows.slice(2); // Skip separator row
      elements.push(
        <div key={`table-wrapper-${key}`} className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                {headers.map((h, i) => <th key={i}>{renderTextWithBold(h.trim())}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => <td key={ci}>{renderTextWithBold(cell.trim())}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };
  
  const renderTextWithBold = (txt: string) => {
    const parts = txt.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Table line
    if (line.startsWith('|')) {
      flushList(i);
      inTable = true;
      const cells = line.split('|').slice(1, -1);
      tableRows.push(cells);
      continue;
    } else {
      flushTable(i);
    }
    
    // List item
    if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true;
      listItems.push(<li key={`li-${i}`}>{renderTextWithBold(line.slice(2))}</li>);
      continue;
    } else {
      flushList(i);
    }
    
    // Headers
    if (line.startsWith('#### ')) {
      elements.push(<h5 key={i} className="report-h5">{renderTextWithBold(line.slice(5))}</h5>);
    } else if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="report-h4">{renderTextWithBold(line.slice(4))}</h4>);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="report-h3">{renderTextWithBold(line.slice(3))}</h3>);
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="report-h2">{renderTextWithBold(line.slice(2))}</h2>);
    } else if (line === '') {
      // Empty line spacer
    } else {
      elements.push(<p key={i} className="report-p">{renderTextWithBold(line)}</p>);
    }
  }
  
  flushList('end');
  flushTable('end');
  
  return elements;
}

export default function DebatePanel({ messages, activeAgent }: DebatePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeModalMessage, setActiveModalMessage] = useState<AgentMessage | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  return (
    <div className="debate-panel">
      <div className="debate-header">
        <div className="debate-header-left">
          <div className="debate-icon">💬</div>
          <div>
            <h3 className="debate-title">Board Debate Transcript</h3>
            <p className="debate-subtitle">
              {messages.length === 0
                ? 'Waiting for analysis request...'
                : `${messages.length} of 4 analysts reported`}
            </p>
          </div>
        </div>
        {activeAgent && (
          <div className="live-indicator">
            <span className="live-dot" />
            LIVE
          </div>
        )}
      </div>

      <div className="debate-messages" ref={scrollRef}>
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div
              className="debate-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="empty-icon">🏛️</div>
              <p>The boardroom is ready.</p>
              <p className="empty-hint">
                Enter a token above to convene the investment committee.
              </p>
            </motion.div>
          ) : (
            messages.map((msg, index) => {
              const agent = AGENT_PROFILES[msg.agent] as any;
              const cleanContent = cleanAgentContent(msg.content, msg.agent);
              const stats = extractQuickStats(cleanContent, msg.agent);
              const previewText = getSnippet(cleanContent);
              
              return (
                <motion.div
                  key={`${msg.agent}-${index}`}
                  className={`debate-message-card ${activeAgent === msg.agent ? 'speaking' : ''}`}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <div className="card-header">
                    <div className="card-header-left">
                      <div
                        className="message-avatar"
                        style={{
                          borderColor: agent.color,
                          background: agent.bgColor,
                        }}
                      >
                        {agent.emoji}
                      </div>
                      <div className="message-meta">
                        <span className="message-name" style={{ color: agent.color }}>
                          {agent.name}
                        </span>
                        <span className="message-role">{agent.title}</span>
                      </div>
                    </div>
                    
                    {stats.badge && (
                      <span className={`card-badge ${stats.status}`}>
                        {stats.badge}
                      </span>
                    )}
                  </div>

                  <div className="card-body">
                    <p className="card-preview">{previewText}</p>
                    <div className="card-fade-mask" />
                  </div>

                  <div className="card-footer">
                    <button
                      className="view-report-button"
                      onClick={() => setActiveModalMessage(msg)}
                      style={{ 
                        '--agent-color': agent.color,
                        '--agent-glow': agent.glowColor || agent.color 
                      } as any}
                    >
                      Read Full Report
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>

        {/* Typing indicator */}
        {activeAgent && (
          <motion.div
            className="typing-indicator"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="typing-avatar"
              style={{
                borderColor: AGENT_PROFILES[activeAgent].color,
                background: AGENT_PROFILES[activeAgent].bgColor,
              }}
            >
              {AGENT_PROFILES[activeAgent].emoji}
            </div>
            <div className="typing-dots">
              <span style={{ background: AGENT_PROFILES[activeAgent].color }} />
              <span style={{ background: AGENT_PROFILES[activeAgent].color }} />
              <span style={{ background: AGENT_PROFILES[activeAgent].color }} />
            </div>
            <span className="typing-text" style={{ color: AGENT_PROFILES[activeAgent].color }}>
              {AGENT_PROFILES[activeAgent].name} is analyzing...
            </span>
          </motion.div>
        )}
      </div>

      {/* Glassmorphic detailed modal overlay */}
      <AnimatePresence>
        {activeModalMessage && (
          <motion.div
            className="report-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModalMessage(null)}
          >
            <motion.div
              className="report-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                '--agent-color': AGENT_PROFILES[activeModalMessage.agent].color,
                '--agent-glow': AGENT_PROFILES[activeModalMessage.agent].glowColor || AGENT_PROFILES[activeModalMessage.agent].color
              } as any}
            >
              <div className="modal-header">
                <div className="modal-agent-profile">
                  <div
                    className="modal-agent-avatar"
                    style={{
                      borderColor: AGENT_PROFILES[activeModalMessage.agent].color,
                      background: AGENT_PROFILES[activeModalMessage.agent].bgColor,
                    }}
                  >
                    {AGENT_PROFILES[activeModalMessage.agent].emoji}
                  </div>
                  <div>
                    <h3 className="modal-agent-name" style={{ color: AGENT_PROFILES[activeModalMessage.agent].color }}>
                      {AGENT_PROFILES[activeModalMessage.agent].name}
                    </h3>
                    <p className="modal-agent-role">{AGENT_PROFILES[activeModalMessage.agent].title}</p>
                  </div>
                </div>

                <div className="modal-header-right">
                  {(() => {
                    const clean = cleanAgentContent(activeModalMessage.content, activeModalMessage.agent);
                    const stats = extractQuickStats(clean, activeModalMessage.agent);
                    return stats.badge && (
                      <span className={`modal-badge ${stats.status}`}>
                        {stats.badge}
                      </span>
                    );
                  })()}
                  <button className="modal-close-button" onClick={() => setActiveModalMessage(null)}>
                    &times;
                  </button>
                </div>
              </div>

              <div className="modal-body custom-scrollbar">
                {parseMarkdown(cleanAgentContent(activeModalMessage.content, activeModalMessage.agent))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
