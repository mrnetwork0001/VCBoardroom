import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AGENT_PROFILES, type AgentType } from '../data/mockDebates';
import './TokenInput.css';

interface TokenInputProps {
  onSubmit: (token: string) => void;
  onReset: () => void;
  isAnalyzing: boolean;
  hasResult: boolean;
}

const SUGGESTED_TOKENS = ['SOL', 'JUP', 'WIF', 'BONK', 'RAY', 'RNDR', 'HNT'];

export default function TokenInput({ onSubmit, onReset, isAnalyzing, hasResult }: TokenInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isAnalyzing) {
      onSubmit(value.trim().toUpperCase().replace('$', ''));
    }
  };

  const handleSuggestionClick = (token: string) => {
    setValue(token);
    onSubmit(token);
  };

  const handleResetClick = () => {
    setValue('');
    onReset();
    inputRef.current?.focus();
  };

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="token-input-wrapper">
      <motion.div
        className={`token-input-container ${isFocused ? 'focused' : ''} ${isAnalyzing ? 'analyzing' : ''}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="input-header">
          <div className="input-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <form onSubmit={handleSubmit} style={{ flex: 1 }}>
            <input
              ref={inputRef}
              type="text"
              className="token-input"
              placeholder="Enter token or protocol (e.g. SOL, JUP, WIF)..."
              value={value}
              onChange={(e) => {
                const newVal = e.target.value.toUpperCase();
                setValue(newVal);
                if (newVal.trim() === '') {
                  onReset();
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={isAnalyzing}
              id="token-search-input"
            />
          </form>
          {(value || hasResult) && !isAnalyzing && (
            <motion.button
              type="button"
              className="reset-button"
              onClick={handleResetClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Reset
            </motion.button>
          )}
          <motion.button
            className="analyze-button"
            onClick={handleSubmit}
            disabled={!value.trim() || isAnalyzing}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isAnalyzing ? (
              <span className="analyzing-text">
                <span className="dot">●</span>
                <span className="dot">●</span>
                <span className="dot">●</span>
                Analyzing
              </span>
            ) : (
              'Convene Board'
            )}
          </motion.button>
        </div>

        <AnimatePresence>
          {!isAnalyzing && (
            <motion.div
              className="suggestions"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <span className="suggestions-label">Quick analysis:</span>
              {SUGGESTED_TOKENS.map((token) => (
                <button
                  key={token}
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick(token)}
                >
                  ${token}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {isAnalyzing && (
          <motion.div
            className="agent-progress"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {(Object.keys(AGENT_PROFILES) as AgentType[]).map((key, i) => {
              const agent = AGENT_PROFILES[key];
              return (
                <motion.div
                  key={key}
                  className="agent-progress-item"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15 }}
                >
                  <span className="agent-dot" style={{ background: agent.color }} />
                  <span className="agent-progress-name">{agent.name}</span>
                  <span className="agent-progress-status">
                    {i < 2 ? 'Analyzing...' : 'Queued'}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
