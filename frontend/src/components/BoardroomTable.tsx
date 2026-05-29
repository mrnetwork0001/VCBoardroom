import { motion } from 'framer-motion';
import { AGENT_PROFILES, type AgentType } from '../data/mockDebates';
import './BoardroomTable.css';

interface BoardroomTableProps {
  activeAgent: AgentType | null;
  analyzedToken: string | null;
}

export default function BoardroomTable({ activeAgent, analyzedToken }: BoardroomTableProps) {
  const agents = Object.entries(AGENT_PROFILES) as [AgentType, typeof AGENT_PROFILES[AgentType]][];

  return (
    <div className="boardroom-table-wrapper">
      <div className="boardroom-table">
        {/* Central table surface */}
        <div className="table-center">
          <div className="table-surface">
            <div className="table-logo">VC</div>
            {analyzedToken && (
              <motion.div
                className="table-token"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                ${analyzedToken}
              </motion.div>
            )}
          </div>
        </div>

        {/* Agent seats */}
        {agents.map(([key, agent]) => {
          const isActive = activeAgent === key;
          const positions: Record<AgentType, React.CSSProperties> = {
            security: { top: '-25px', left: '15%', transform: 'translateX(-50%)' },
            quant: { top: '-25px', right: '15%', transform: 'translateX(50%)' },
            sentiment: { top: '45%', right: '-35px', transform: 'translateY(-50%)' },
            meme: { top: '45%', left: '-35px', transform: 'translateY(-50%)' },
            lead: { bottom: '-35px', left: '50%', transform: 'translateX(-50%)' },
          };

          return (
            <motion.div
              key={key}
              className={`agent-seat agent-seat-${key} ${isActive ? 'active' : ''}`}
              style={positions[key]}
              animate={isActive ? {
                scale: [1, 1.08, 1],
                transition: { duration: 1.5, repeat: Infinity }
              } : {}}
            >
              <div
                className="agent-avatar"
                style={{
                  borderColor: agent.color,
                  boxShadow: isActive ? `0 0 24px ${agent.glowColor}` : 'none',
                }}
              >
                <span className="agent-emoji">{agent.emoji}</span>
                {isActive && (
                  <div className="soundwave-container">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="soundwave-bar"
                        style={{
                          background: agent.color,
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="agent-label">
                <span className="agent-name" style={{ color: agent.color }}>
                  {agent.name}
                </span>
                <span className="agent-title">{agent.title}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
