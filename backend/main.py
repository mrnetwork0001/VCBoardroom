# ============================================
# Virtual VC Boardroom — FastAPI Server
# ============================================

import os
import json
import shutil
from typing import Optional
from dotenv import load_dotenv

# Load environment variables BEFORE importing agents
load_dotenv()

# Clear the agent workspace on startup to prevent memory bloat/slowdown
WORKSPACE_DIR = os.path.join(os.path.dirname(__file__), "agent_workspace")
if os.path.exists(WORKSPACE_DIR):
    try:
        shutil.rmtree(WORKSPACE_DIR)
        print(f"🧹 Cleaned Swarms agent workspace directory at {WORKSPACE_DIR}")
    except Exception as e:
        print(f"⚠️ Failed to clean agent workspace directory: {e}")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agents import create_boardroom_agents, run_boardroom_analysis, run_boardroom_analysis_stream
from market_data import fetch_coingecko_data, fetch_defillama_data

app = FastAPI(
    title="Virtual VC Boardroom API",
    description="Multi-Agent Investment Intelligence powered by Swarms Framework",
    version="1.0.0",
)

# CORS — allow frontend dev server and Vercel deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://vc-boardroom.vercel.app",
    ],
    allow_origin_regex=r"https://vc-boardroom-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------
# Request / Response Models
# -------------------------------------------

class AnalyzeRequest(BaseModel):
    token: str
    model_name: Optional[str] = "gpt-4o-mini"
    degen_mode: Optional[bool] = False


class AgentReport(BaseModel):
    agent: str
    name: str
    content: str


class AnalyzeResponse(BaseModel):
    token: str
    reports: list[AgentReport]
    success: bool


class HealthResponse(BaseModel):
    status: str
    agents: int
    framework: str


# -------------------------------------------
# Routes
# -------------------------------------------

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="operational",
        agents=5,
        framework="swarms",
    )


@app.post("/api/analyze")
async def analyze_token(request: AnalyzeRequest):
    """
    Run a full VC Boardroom analysis for a given token and stream progress/reports.
    
    This endpoint convenes all five AI agents:
    1. Security Auditor
    2. The Quant
    3. Sentiment Analyst  
    4. Meme Strategist
    5. Lead Partner (synthesis + verdict)
    
    Streams events as Server-Sent Events (SSE).
    """
    token = request.token.upper().replace("$", "")
    
    if not token:
        raise HTTPException(status_code=400, detail="Token symbol is required")
    
    async def event_generator():
        try:
            async for event in run_boardroom_analysis_stream(token, request.model_name, request.degen_mode or False):
                yield f"data: {json.dumps(event)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            err_msg = {"status": "error", "message": str(e)}
            yield f"data: {json.dumps(err_msg)}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/agents")
async def list_agents():
    """List all available VC Boardroom agents and their descriptions"""
    return {
        "agents": [
            {
                "id": "security",
                "name": "Security Auditor",
                "title": "Chief Security Officer",
                "emoji": "🛡️",
                "description": "Smart contract audits, rug-pull detection, and risk assessment",
            },
            {
                "id": "quant",
                "name": "The Quant",
                "title": "Quantitative Analyst",
                "emoji": "🧬",
                "description": "Tokenomics, FDV analysis, on-chain metrics, and valuation models",
            },
            {
                "id": "sentiment",
                "name": "Sentiment Analyst",
                "title": "Narrative Strategist",
                "emoji": "📢",
                "description": "Social media sentiment, narrative tracking, and hype detection",
            },
            {
                "id": "meme",
                "name": "Meme Strategist",
                "title": "Cultural Resonance Expert",
                "emoji": "🐸",
                "description": "Virality potential, ticker resonance, mascot appeal, and cultural mindshare",
            },
            {
                "id": "lead",
                "name": "Lead Partner",
                "title": "Managing Director",
                "emoji": "💼",
                "description": "Synthesis, final verdict, and portfolio allocation recommendation",
            },
        ]
    }


@app.get("/api/market-data/{token}")
async def get_market_data(token: str):
    """Fetch real-time market data for a token from CoinGecko + DeFiLlama"""
    symbol = token.upper().replace("$", "")
    
    cg_data = fetch_coingecko_data(symbol)
    dl_data = fetch_defillama_data(symbol)
    
    if not cg_data and not dl_data:
        raise HTTPException(status_code=404, detail=f"No market data found for {symbol}")
    
    return {
        "token": symbol,
        "coingecko": cg_data,
        "defillama": dl_data,
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 8000))
    print(f"\n🏛️ Virtual VC Boardroom API starting on port {port}...")
    print(f"📡 Live market data: CoinGecko + DeFiLlama")
    print(f"🤖 AI Engine: OpenAI ({os.environ.get('MODEL_NAME', 'gpt-4o-mini')})")
    print(f"📖 Docs: http://localhost:{port}/docs\n")
    
    uvicorn.run(app, host="0.0.0.0", port=port)
