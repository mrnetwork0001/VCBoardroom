# 🏛️ Virtual VC Boardroom

**Multi-Agent Investment Intelligence Platform** — Built for the [Swarms ACM Hackathon 2026](https://docs.swarms.ai/docs/marketplace/acm-hackathon)

> Four AI agents: Security Auditor, Quant, Sentiment Analyst, and Lead Partner - debate the investment thesis of any cryptocurrency token in real-time.

---

## 🎯 What It Does

The Virtual VC Boardroom simulates a hedge fund investment committee meeting. When a user inputs any token or protocol:

1. 🔒 **Security Auditor** — Hunts for red flags: rug-pull risks, contract vulnerabilities, centralization vectors
2. 📊 **The Quant** — Analyzes tokenomics: FDV, MC/FDV ratio, inflation rates, on-chain metrics, fair value models
3. 🐦 **Sentiment Analyst** — Scans X/Twitter narrative: real hype vs. fake hype, influencer consensus, community health
4. 🏛️ **Lead Partner** — Synthesizes all reports and delivers a **GO / NO-GO / HOLD** verdict with recommended portfolio allocation

### Why It Stands Out

- **Multi-Agent Debate System**: Not just Q&A — agents *debate* and *challenge* each other's findings
- **Frenzy Mode**: Toggle to activate a simulated bonding curve trading terminal for the agent's own token (`$VCB`)
- **Production-Ready Backend**: Built on the official `swarms` Python framework with FastAPI
- **Stunning UI**: Glassmorphic dark dashboard with soundwave animations, typing indicators, and dynamic glows

---

## 🚀 Quick Start

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

The dashboard launches at `http://localhost:5173` with **full mock mode** — no API keys needed.

### Backend (Python + Swarms SDK)

```bash
cd backend
pip install -r requirements.txt

# Set your API key
set OPENAI_API_KEY=your-key-here

# Run the server
python main.py
```

The API launches at `http://localhost:8000` with Swagger docs at `/docs`.

#### CLI Mode (Quick Test)

```bash
python agents.py SOL
python agents.py JUP
python agents.py WIF
```

---

## 🔥 Frenzy Mode

Toggle the **FRENZY** switch in the top-right to activate:
- 📈 **Bonding Curve Chart** — Real-time price visualization
- 📖 **Order Book** — Simulated bid/ask spread
- ⚡ **Live Trade Feed** — Streaming buy/sell transactions
- 📊 **Migration Progress** — Progress toward DEX listing threshold

This demonstrates how the agent would function as a **tokenized asset** on the Swarms Marketplace.

---

## 🏗️ Architecture

```
swarms/
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/     # BoardroomTable, DebatePanel, VerdictCard, FrenzyTerminal
│   │   ├── data/           # Mock debate scripts (SOL, JUP, WIF)
│   │   ├── utils/          # Frenzy mode bonding curve simulator
│   │   └── App.tsx         # Main orchestrator
│   └── package.json
├── backend/                # Python + Swarms SDK + FastAPI
│   ├── agents.py           # 4 Agent definitions with system prompts
│   ├── main.py             # FastAPI server
│   └── requirements.txt
└── README.md
```

---

## 🏆 Hackathon Compliance

| Requirement | Status |
|---|---|
| Build a high-quality agent for real-world use in DeFi/Finance | ✅ Multi-agent investment committee |
| Enable Frenzy Mode | ✅ Full bonding curve + trade terminal |
| Publish on Swarms Marketplace | 🔜 Ready for deployment |
| Tokenize and list for sale | 🔜 `$VCB` token configured |
| Real-world utility | ✅ Investment analysis across any Solana token |

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Framer Motion, Recharts
- **Backend**: Python 3.13, Swarms SDK, FastAPI, Uvicorn
- **Chain**: Solana
- **Agent Framework**: [Swarms](https://github.com/kyegomez/swarms) multi-agent orchestration

---

## 📄 License

MIT — Built for the Swarms ACM Hackathon 2026
