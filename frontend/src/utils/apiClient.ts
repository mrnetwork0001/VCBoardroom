// ============================================
// API Client — Connects frontend to Python backend
// Falls back to mock data if backend is unavailable
// ============================================

import { type DebateResult, type AgentMessage, AGENT_PROFILES } from '../data/mockDebates';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Check if the Python backend is running
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      return data.status === 'operational';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Fetch real-time market data from the backend
 */
export async function fetchMarketData(token: string): Promise<Record<string, unknown> | null> {
  try {
    const resp = await fetch(`${API_BASE}/api/market-data/${token}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      return await resp.json();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Run a full boardroom analysis via the Python backend (real AI agents).
 * 
 * @param token - Token symbol (e.g. "SOL")
 * @param onAgentStart - Callback when an agent begins analyzing
 * @param onAgentComplete - Callback when an agent finishes with its message
 * @returns The final debate result
 */
export async function runAnalysis(
  token: string,
  onAgentStart: (agent: keyof typeof AGENT_PROFILES) => void,
  onAgentComplete: (message: AgentMessage) => void,
): Promise<DebateResult> {
  const backendUp = await checkBackendHealth();
  
  if (!backendUp) {
    throw new Error('AI analysis backend is offline. Please launch the backend server using "python main.py" in the backend directory.');
  }
  
  console.log('🟢 Connecting to live AI backend and establishing stream...');
  
  // Show first agent starting
  onAgentStart('security');
  
  const resp = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  
  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.detail || `Analysis failed with status ${resp.status}`);
  }
  
  const reader = resp.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) {
    throw new Error('ReadableStream not supported by browser response.');
  }
  
  const messages: AgentMessage[] = [];
  let leadReportContent = '';
  let buffer = '';
  let timestampIndex = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    
    // Save the last incomplete line to buffer
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6).trim();
        if (jsonStr === '[DONE]') {
          continue;
        }
        
        try {
          const payload = JSON.parse(jsonStr);
          
          if (payload.status === 'error') {
            throw new Error(payload.message || 'Error occurred during streaming analysis.');
          }
          
          const agentKey = payload.agent as keyof typeof AGENT_PROFILES;
          
          if (payload.status === 'start') {
            onAgentStart(agentKey);
          } else if (payload.status === 'complete') {
            const message: AgentMessage = {
              agent: agentKey,
              content: payload.content,
              timestamp: timestampIndex++,
            };
            messages.push(message);
            onAgentComplete(message);
            
            if (agentKey === 'lead') {
              leadReportContent = payload.content;
            }
          }
        } catch (e: any) {
          console.error('Failed to parse stream event:', e);
          if (e.message && e.message.includes('Error occurred during')) {
            throw e;
          }
        }
      }
    }
  }
  
  // Extract verdict from lead partner's report
  const verdict = parseVerdictFromReport(leadReportContent);
  
  return {
    token,
    messages,
    verdict,
  };
}

/**
 * Parse a GO/NO-GO/HOLD verdict from the Lead Partner's report text
 */
function parseVerdictFromReport(report: string): DebateResult['verdict'] {
  const upper = report.toUpperCase();
  
  let decision: 'GO' | 'NO-GO' | 'HOLD' = 'HOLD';
  if (upper.includes('NO-GO') || upper.includes('🔴')) {
    decision = 'NO-GO';
  } else if (upper.includes('VERDICT: GO') || upper.includes('🟢')) {
    decision = 'GO';
  }
  
  // Try to extract score
  let score = 50;
  const scoreMatch = report.match(/(?:composite\s+score|score)[:\s]*(\d{1,3})/i);
  if (scoreMatch) {
    score = Math.min(100, parseInt(scoreMatch[1]));
  }
  
  // Try to extract allocation
  let allocation = '0%';
  const allocMatch = report.match(/(?:allocation|allocate)[:\s]*([0-9%\-→\s\w]+)/i);
  if (allocMatch) {
    allocation = allocMatch[1].trim().substring(0, 40);
  }
  
  return {
    decision,
    score,
    allocation,
    rationale: report,
  };
}
