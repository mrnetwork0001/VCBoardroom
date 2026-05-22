# ============================================
# Virtual VC Boardroom — Agent Definitions
# Using the Swarms Framework (swarms SDK)
# ============================================

import os
import asyncio
from dotenv import load_dotenv
from swarms import Agent
from market_data import format_market_data_for_agents

# Load environment variables
load_dotenv()

# -------------------------------------------
# System Prompts for Each VC Persona
# -------------------------------------------

SECURITY_AUDITOR_PROMPT = """You are the **Security Auditor** of a virtual venture capital boardroom.

Your role is to analyze the security posture of cryptocurrency tokens, protocols, and smart contracts.

When given a token or protocol to analyze, you MUST evaluate:
1. **Smart Contract Risk**: Audit status, known exploits, code quality
2. **Centralization Vectors**: Admin keys, mint authority, freeze authority, Nakamoto coefficient
3. **Supply Chain Risk**: Client diversity, validator/node distribution
4. **Historical Incidents**: Past hacks, outages, exploits
5. **Rug-Pull Risk Assessment**: Liquidity locks, team token distribution

Output your analysis in a structured report format with:
- Clear section headers using markdown bold
- A risk score out of 10 (10 = lowest risk)
- Specific data points and metrics
- Actionable warnings marked with ⚠️

Be thorough, data-driven, and skeptical. Your job is to find every possible red flag.
End with a clear Risk Score: X/10 rating.
"""

QUANT_ANALYST_PROMPT = """You are **The Quant** — a quantitative analyst in a virtual venture capital boardroom.

Your role is to analyze the financial and tokenomic fundamentals of cryptocurrency tokens and protocols.

When given a token to analyze, you MUST evaluate:
1. **Tokenomics**: Total supply, circulating supply, inflation rate, emission schedule
2. **Market Metrics**: Market cap, FDV, MC/FDV ratio, daily volume
3. **On-Chain Metrics**: Active addresses, transaction count, DEX volume, TVL
4. **Valuation Models**: P/E ratio (based on protocol revenue), NVT ratio, comparable analysis
5. **Token Unlock Schedule**: Vesting schedules, upcoming unlocks, dilution risk

Output your analysis with:
- Clear quantitative data points
- Fair value estimates with methodology
- Key risk metrics (MC/FDV ratio below 0.5 is a red flag)
- Comparison to sector peers

Be precise with numbers. Use tables where helpful.
End with a Fair Value Estimate and confidence level.
"""

SENTIMENT_ANALYST_PROMPT = """You are the **Sentiment Analyst** — a narrative strategist in a virtual venture capital boardroom.

Your role is to analyze the social sentiment, community strength, and narrative positioning of cryptocurrency tokens.

When given a token to analyze, you MUST evaluate:
1. **Social Metrics**: Use the REAL data provided (LunarCrush, CoinGecko follower counts). If social data source is marked as UNAVAILABLE, explicitly state "real-time social data unavailable" and use your training knowledge to provide qualitative analysis instead.
2. **Sentiment Score**: If LunarCrush data is available, use their Galaxy Score and bullish/bearish ratios. Otherwise, provide a qualitative assessment based on your knowledge.
3. **Active Narratives**: What stories are driving interest? Are they authentic?
4. **Counter-Narratives**: What FUD exists? Is it legitimate?
5. **Influencer Analysis**: Key opinion leader consensus
6. **Hype vs Substance Score**: Is the narrative backed by real utility, or is it empty hype? (0-100)

CRITICAL RULES:
- ONLY cite specific numbers (mention counts, follower counts) if they appear in the provided market data.
- Do NOT fabricate or hallucinate specific social metrics. If real data is unavailable, say so.
- You CAN provide qualitative narrative analysis based on your training knowledge.
- Clearly label what is "verified data" vs "analyst assessment based on training data."

Output with:
- Real metrics from provided data (if available)
- Named narratives with brief descriptions
- Clear hype vs. substance assessment
- Warning signs of artificial amplification or bot activity

Be skeptical of hype. Distinguish authentic community growth from manufactured narratives.
End with a Hype/Substance Score: X/100.
"""

LEAD_PARTNER_PROMPT = """You are the **Lead Partner** — the Managing Director of a virtual venture capital boardroom.

You receive analysis reports from three specialized analysts:
1. Security Auditor — risk and vulnerability assessment
2. The Quant — financial and tokenomic analysis
3. Sentiment Analyst — social narrative and community analysis

Your role is to:
1. **Synthesize** all three reports into a coherent investment thesis
2. **Weigh** the evidence — security issues can override strong fundamentals
3. **Deliver a final verdict**: GO (invest), NO-GO (pass), or HOLD (wait for better entry)
4. **Recommend portfolio allocation** as a percentage (0% to 10% max)

Your output MUST follow this EXACT structure:

## Verdict: [🟢 GO / 🔴 NO-GO / 🟡 HOLD]
## Composite Score: [X]/100

### Key Conviction Drivers
1. [First reason]
2. [Second reason]
3. [Third reason]

### Risks to Monitor
- [Risk 1]
- [Risk 2]
- [Risk 3]

### Recommended Allocation: [X]%
[One paragraph explaining position sizing rationale]

IMPORTANT RULES:
- Be decisive. The board expects clear recommendations, not hedging.
- Do NOT repeat yourself. Write your conclusion ONCE and stop.
- Keep your response concise and under 600 words.
- End after the allocation rationale. Do not add additional sections.
"""


def create_boardroom_agents(model_name: str = "gpt-4o-mini"):
    """
    Create and return the four VC Boardroom agents using the Swarms framework.
    
    Args:
        model_name: The LLM model to use (default: gpt-4o-mini)
    
    Returns:
        Dictionary of four Agent instances keyed by role name
    """
    
    # Shared agent config
    common_config = {
        "model_name": model_name,
        "max_loops": 1,
        "verbose": True,
        "dynamic_temperature_enabled": False,
        "temperature": 0.7,
        "max_tokens": 4096,
        "streaming_on": False,
        "autosave": False,
    }
    
    security_auditor = Agent(
        agent_name="Security-Auditor",
        agent_description="Chief Security Officer analyzing smart contract risks and vulnerabilities",
        system_prompt=SECURITY_AUDITOR_PROMPT,
        **common_config,
    )
    
    quant_analyst = Agent(
        agent_name="The-Quant",
        agent_description="Quantitative Analyst evaluating tokenomics, FDV, and valuation models",
        system_prompt=QUANT_ANALYST_PROMPT,
        **common_config,
    )
    
    sentiment_analyst = Agent(
        agent_name="Sentiment-Analyst",
        agent_description="Narrative Strategist analyzing social sentiment and community hype",
        system_prompt=SENTIMENT_ANALYST_PROMPT,
        **common_config,
    )
    
    lead_partner = Agent(
        agent_name="Lead-Partner",
        agent_description="Managing Director synthesizing all reports and delivering GO/NO-GO verdict",
        system_prompt=LEAD_PARTNER_PROMPT,
        model_name=model_name,
        max_loops=1,
        verbose=True,
        dynamic_temperature_enabled=False,
        temperature=0.7,
        max_tokens=8192,  # Lead Partner needs more tokens to synthesize 3 reports
        streaming_on=False,
        autosave=False,
    )
    
    return {
        "security": security_auditor,
        "quant": quant_analyst,
        "sentiment": sentiment_analyst,
        "lead": lead_partner,
    }


def clean_agent_report(report_content: str, token: str) -> str:
    """
    Strips the duplicated prompt and market briefing from the agent's output.
    This prevents scroll exhaustion in the UI and excessive token bloat in the synthesis.
    """
    if not report_content:
        return ""
        
    report_content = report_content.strip()
    lower_content = report_content.lower()
    
    # 1. Check for standard analyst prompt repeating
    if "analyze the cryptocurrency token:" in lower_content:
        # Check for the end of the market data block
        if "=== end of market data ===" in lower_content:
            idx = lower_content.find("=== end of market data ===")
            # Look for the next newline after the marker
            end_idx = report_content.find("\n", idx)
            if end_idx != -1:
                remaining = report_content[end_idx:].strip()
                # Skip "Use the real numbers above. Do NOT make up data." if present
                lines = remaining.strip().split("\n")
                if lines and ("use the real numbers" in lines[0].lower() or "do not make up" in lines[0].lower()):
                    remaining = "\n".join(lines[1:]).strip()
                return remaining
                
    # 2. Check for Lead Partner synthesis prompt repeating
    if "you are reviewing investment reports for token:" in lower_content:
        marker = "deliver your final investment verdict."
        if marker in lower_content:
            idx = lower_content.find(marker)
            end_idx = report_content.find("\n", idx)
            if end_idx != -1:
                return report_content[end_idx:].strip()
                
    return report_content


def run_boardroom_analysis(token: str, model_name: str = "gpt-4o-mini") -> dict:
    """
    Run a full VC Boardroom analysis for a given token.
    
    This executes all four agents sequentially:
    1. Security Auditor analyzes risks
    2. Quant Analyst evaluates tokenomics
    3. Sentiment Analyst reads the narrative
    4. Lead Partner synthesizes all reports and delivers verdict
    
    Args:
        token: The token symbol to analyze (e.g., "SOL", "JUP")
        model_name: The LLM model to use
    
    Returns:
        Dictionary containing each agent's analysis and the final verdict
    """
    agents = create_boardroom_agents(model_name)
    
    # Fetch REAL market data from CoinGecko + DeFiLlama
    print(f"\n📡 Fetching live market data for {token}...")
    market_briefing = format_market_data_for_agents(token)
    print(f"✅ Market data loaded.\n")
    
    query = f"""Analyze the cryptocurrency token: {token.upper()}. 
Provide a comprehensive assessment for the VC investment committee.

Here is the LIVE market data you must reference in your analysis:

{market_briefing}

Use the real numbers above. Do NOT make up data."""
    
    results = {}
    
    # 1. Security Auditor
    print(f"\n🔒 Security Auditor analyzing {token}...")
    results["security"] = clean_agent_report(agents["security"].run(query), token)
    
    # 2. Quant Analyst
    print(f"\n📊 The Quant analyzing {token}...")
    results["quant"] = clean_agent_report(agents["quant"].run(query), token)
    
    # 3. Sentiment Analyst
    print(f"\n🐦 Sentiment Analyst analyzing {token}...")
    results["sentiment"] = clean_agent_report(agents["sentiment"].run(query), token)
    
    # 4. Lead Partner — receives all previous reports + market data
    print(f"\n🏛️ Lead Partner synthesizing reports...")
    synthesis_prompt = f"""
    You are reviewing investment reports for token: {token.upper()}
    
    {market_briefing}
    
    === SECURITY AUDITOR REPORT ===
    {results["security"]}
    
    === QUANT ANALYST REPORT ===
    {results["quant"]}
    
    === SENTIMENT ANALYST REPORT ===
    {results["sentiment"]}
    
    Based on all three reports and the real-time market data above, deliver your final investment verdict.
    """
    results["lead"] = clean_agent_report(agents["lead"].run(synthesis_prompt), token)
    
    return results


async def run_boardroom_analysis_stream(token: str, model_name: str = "gpt-4o-mini"):
    """
    Run a full VC Boardroom analysis for a given token and yield progress/reports.
    """
    agents = create_boardroom_agents(model_name)
    
    # Fetch REAL market data from CoinGecko + DeFiLlama
    print(f"\n📡 Fetching live market data for {token}...")
    market_briefing = await asyncio.to_thread(format_market_data_for_agents, token)
    print(f"✅ Market data loaded.\n")
    
    query = f"""Analyze the cryptocurrency token: {token.upper()}. 
Provide a comprehensive assessment for the VC investment committee.

Here is the LIVE market data you must reference in your analysis:

{market_briefing}

Use the real numbers above. Do NOT make up data."""
    
    results = {}
    
    # Run the three analysts sequentially
    analyst_roles = [
        ("security", "Security Auditor"),
        ("quant", "The Quant"),
        ("sentiment", "Sentiment Analyst")
    ]
    
    for key, name in analyst_roles:
        yield {
            "status": "start",
            "agent": key,
            "name": name,
            "content": ""
        }
        print(f"\n🔒 {name} analyzing {token}...")
        report = await asyncio.to_thread(agents[key].run, query)
        results[key] = clean_agent_report(str(report), token)
        yield {
            "status": "complete",
            "agent": key,
            "name": name,
            "content": results[key]
        }
        
    # Lead Partner synthesizes
    yield {
        "status": "start",
        "agent": "lead",
        "name": "Lead Partner",
        "content": ""
    }
    print(f"\n🏛️ Lead Partner synthesizing reports...")
    synthesis_prompt = f"""
    You are reviewing investment reports for token: {token.upper()}
    
    {market_briefing}
    
    === SECURITY AUDITOR REPORT ===
    {results["security"]}
    
    === QUANT ANALYST REPORT ===
    {results["quant"]}
    
    === SENTIMENT ANALYST REPORT ===
    {results["sentiment"]}
    
    Based on all three reports and the real-time market data above, deliver your final investment verdict.
    """
    lead_report = await asyncio.to_thread(agents["lead"].run, synthesis_prompt)
    results["lead"] = clean_agent_report(str(lead_report), token)
    
    yield {
        "status": "complete",
        "agent": "lead",
        "name": "Lead Partner",
        "content": results["lead"]
    }


# CLI entry point for standalone testing
if __name__ == "__main__":
    import sys
    
    token = sys.argv[1] if len(sys.argv) > 1 else "SOL"
    print(f"\n{'='*60}")
    print(f"  VIRTUAL VC BOARDROOM — Analyzing ${token.upper()}")
    print(f"{'='*60}\n")
    
    results = run_boardroom_analysis(token)
    
    print(f"\n{'='*60}")
    print("  ANALYSIS COMPLETE")
    print(f"{'='*60}\n")
    
    for agent_name, report in results.items():
        print(f"\n--- {agent_name.upper()} ---")
        print(report)
        print()
