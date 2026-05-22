# ============================================
# Virtual VC Boardroom — Live Market Data
# Fetches real data from:
#   - CoinGecko (FREE, no key)
#   - DeFiLlama (FREE, no key)
#   - Birdeye (FREE tier, key required)
#   - LunarCrush (FREE tier, key required)
# ============================================

import os
import requests
from typing import Optional

# -------------------------------------------
# CoinGecko (FREE — no API key)
# -------------------------------------------

TOKEN_ID_MAP = {
    "SOL": "solana",
    "JUP": "jupiter-exchange-solana",
    "WIF": "dogwifcoin",
    "BONK": "bonk",
    "RAY": "raydium",
    "RNDR": "render-token",
    "HNT": "helium",
    "PYTH": "pyth-network",
    "JTO": "jito-governance-token",
    "W": "wormhole",
    "ORCA": "orca",
    "MNGO": "mango-markets",
    "DRIFT": "drift-protocol",
    "TENSOR": "tensor",
    "INF": "infinity-by-sanctum",
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "AVAX": "avalanche-2",
    "SUI": "sui",
    "APT": "aptos",
}

# Birdeye Solana token mint addresses
SOLANA_MINT_MAP = {
    "SOL": "So11111111111111111111111111111111111111112",
    "JUP": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    "WIF": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    "BONK": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "RAY": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    "PYTH": "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    "ORCA": "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    "JTO": "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
}


def fetch_coingecko_data(token: str) -> Optional[dict]:
    """Fetch real-time market data from CoinGecko (FREE, no key needed)."""
    symbol = token.upper().replace("$", "")
    cg_id = TOKEN_ID_MAP.get(symbol)
    
    if not cg_id:
        try:
            search_url = f"https://api.coingecko.com/api/v3/search?query={symbol}"
            resp = requests.get(search_url, timeout=10)
            if resp.status_code == 200:
                coins = resp.json().get("coins", [])
                for coin in coins:
                    if coin.get("symbol", "").upper() == symbol:
                        cg_id = coin["id"]
                        break
        except Exception:
            pass
    
    if not cg_id:
        return None
    
    try:
        url = f"https://api.coingecko.com/api/v3/coins/{cg_id}"
        params = {
            "localization": "false",
            "tickers": "false",
            "market_data": "true",
            "community_data": "true",
            "developer_data": "false",
            "sparkline": "false",
        }
        
        resp = requests.get(url, params=params, timeout=15)
        if resp.status_code != 200:
            print(f"⚠️ CoinGecko returned status {resp.status_code} for {cg_id}")
            return None
        
        data = resp.json()
        market = data.get("market_data", {})
        community = data.get("community_data", {})
        platforms = data.get("platforms", {})
        solana_mint = platforms.get("solana")
        
        result = {
            "name": data.get("name", symbol),
            "symbol": data.get("symbol", symbol).upper(),
            "solana_mint": solana_mint,
            "current_price_usd": market.get("current_price", {}).get("usd"),
            "market_cap_usd": market.get("market_cap", {}).get("usd"),
            "fully_diluted_valuation": market.get("fully_diluted_valuation", {}).get("usd"),
            "total_volume_24h": market.get("total_volume", {}).get("usd"),
            "circulating_supply": market.get("circulating_supply"),
            "total_supply": market.get("total_supply"),
            "max_supply": market.get("max_supply"),
            "price_change_24h_pct": market.get("price_change_percentage_24h"),
            "price_change_7d_pct": market.get("price_change_percentage_7d"),
            "price_change_30d_pct": market.get("price_change_percentage_30d"),
            "ath_usd": market.get("ath", {}).get("usd"),
            "ath_change_pct": market.get("ath_change_percentage", {}).get("usd"),
            "atl_usd": market.get("atl", {}).get("usd"),
            "mcap_fdv_ratio": None,
            "twitter_followers": community.get("twitter_followers"),
            "reddit_subscribers": community.get("reddit_subscribers"),
            "coingecko_rank": data.get("coingecko_rank"),
            "coingecko_score": data.get("coingecko_score"),
            "categories": data.get("categories", []),
        }
        
        if result["market_cap_usd"] and result["fully_diluted_valuation"]:
            result["mcap_fdv_ratio"] = round(
                result["market_cap_usd"] / result["fully_diluted_valuation"], 4
            )
        
        return result
        
    except requests.exceptions.Timeout:
        print(f"⚠️ CoinGecko timeout for {cg_id}")
        return None
    except Exception as e:
        print(f"⚠️ CoinGecko error for {cg_id}: {e}")
        return None


# -------------------------------------------
# DeFiLlama (FREE — no API key)
# -------------------------------------------

def fetch_defillama_data(token: str) -> Optional[dict]:
    """Fetch TVL and protocol data from DeFiLlama (FREE, no key needed)."""
    symbol = token.upper().replace("$", "")
    
    try:
        resp = requests.get("https://api.llama.fi/protocols", timeout=15)
        if resp.status_code != 200:
            return None
        
        protocols = resp.json()
        matched = None
        
        for protocol in protocols:
            if protocol.get("symbol", "").upper() == symbol:
                matched = protocol
                break
        
        if not matched:
            return None
        
        return {
            "protocol_name": matched.get("name"),
            "tvl": matched.get("tvl"),
            "chain": matched.get("chain"),
            "chains": matched.get("chains", []),
            "change_1h": matched.get("change_1h"),
            "change_1d": matched.get("change_1d"),
            "change_7d": matched.get("change_7d"),
            "category": matched.get("category"),
        }
        
    except Exception as e:
        print(f"⚠️ DeFiLlama error: {e}")
        return None


# -------------------------------------------
# Birdeye (FREE tier — requires API key)
# https://docs.birdeye.so/ — sign up for free
# -------------------------------------------

def fetch_birdeye_data(token: str, mint_address: Optional[str] = None) -> Optional[dict]:
    """
    Fetch Solana-specific token data from Birdeye.
    Provides: holder count, DEX liquidity, trade count, unique wallets.
    Requires BIRDEYE_API_KEY in .env (free tier available).
    """
    api_key = os.environ.get("BIRDEYE_API_KEY")
    if not api_key:
        return None
    
    symbol = token.upper().replace("$", "")
    if not mint_address:
        mint_address = SOLANA_MINT_MAP.get(symbol)
    
    if not mint_address:
        return None
    
    headers = {
        "X-API-KEY": api_key,
        "x-chain": "solana",
    }
    
    result = {}
    
    # 1. Token overview
    try:
        resp = requests.get(
            f"https://public-api.birdeye.so/defi/token_overview?address={mint_address}",
            headers=headers,
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            result["birdeye_price"] = data.get("price")
            result["birdeye_price_change_24h"] = data.get("priceChange24hPercent")
            result["holder_count"] = data.get("holder")
            result["unique_wallet_24h"] = data.get("uniqueWallet24h")
            result["unique_wallet_30d"] = data.get("uniqueWallet30d")
            result["trade_24h"] = data.get("trade24h")
            result["trade_30d"] = data.get("trade30d")
            result["volume_24h_usd"] = data.get("v24hUSD")
            result["liquidity_usd"] = data.get("liquidity")
            result["mc"] = data.get("mc")
            result["supply"] = data.get("supply")
            print(f"✅ Birdeye data loaded for {symbol}")
    except Exception as e:
        print(f"⚠️ Birdeye overview error: {e}")
    
    # 2. Token security (rug check)
    try:
        resp = requests.get(
            f"https://public-api.birdeye.so/defi/token_security?address={mint_address}",
            headers=headers,
            timeout=10,
        )
        if resp.status_code == 200:
            sec = resp.json().get("data", {})
            result["is_token_2022"] = sec.get("isToken2022")
            result["mint_authority"] = sec.get("mutableMetadata")  
            result["freeze_authority"] = sec.get("freezeAuthority")
            result["top10_holder_pct"] = sec.get("top10HolderPercent")
            result["creator_balance_pct"] = sec.get("creatorPercentage")
    except Exception as e:
        print(f"⚠️ Birdeye security error: {e}")
    
    return result if result else None


# -------------------------------------------
# LunarCrush (FREE tier — requires API key)
# https://lunarcrush.com/developers — sign up for free
# -------------------------------------------

def fetch_lunarcrush_data(token: str) -> Optional[dict]:
    """
    Fetch real social sentiment data from LunarCrush.
    Requires LUNARCRUSH_API_KEY in .env.
    Note: Free tier access may be limited. Fails gracefully.
    """
    api_key = os.environ.get("LUNARCRUSH_API_KEY")
    if not api_key:
        return None
    
    symbol = token.upper().replace("$", "")
    
    headers = {
        "Authorization": f"Bearer {api_key}",
    }
    
    # Try the coin-specific endpoint with short timeout
    try:
        resp = requests.get(
            f"https://lunarcrush.com/api4/public/coins/{symbol}/meta/v2",
            headers=headers,
            timeout=5,
        )
        
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            result = {
                "name": data.get("name"),
                "galaxy_score": data.get("galaxy_score"),
                "alt_rank": data.get("alt_rank"),
                "social_volume": data.get("social_volume"),
                "social_contributors": data.get("social_contributors"),
                "social_dominance": data.get("social_dominance"),
                "bullish_sentiment": data.get("sentiment_bullish") or data.get("sentiment"),
                "bearish_sentiment": data.get("sentiment_bearish"),
            }
            print(f"✅ LunarCrush loaded for {symbol}")
            return result
        else:
            print(f"⚠️ LunarCrush returned {resp.status_code} for {symbol} (free tier may not cover this endpoint)")
            return None
    except requests.exceptions.Timeout:
        print(f"⚠️ LunarCrush timed out for {symbol}")
        return None
    except Exception as e:
        print(f"⚠️ LunarCrush error: {e}")
        return None


# -------------------------------------------
# Format All Data Into Agent Briefing
# -------------------------------------------

def format_market_data_for_agents(token: str) -> str:
    """
    Fetch and format ALL available market data into a structured briefing
    that gets injected into each agent's prompt.
    
    Sources:
      - CoinGecko (always available, free)
      - DeFiLlama (always available, free)
      - Birdeye (if BIRDEYE_API_KEY set)
      - LunarCrush (if LUNARCRUSH_API_KEY set)
    """
    cg_data = fetch_coingecko_data(token)
    dl_data = fetch_defillama_data(token)
    
    solana_mint = cg_data.get("solana_mint") if cg_data else None
    be_data = fetch_birdeye_data(token, mint_address=solana_mint)
    lc_data = fetch_lunarcrush_data(token)
    
    if not any([cg_data, dl_data, be_data, lc_data]):
        return f"⚠️ No real-time market data available for {token}. Perform analysis based on your training data."
    
    sections = []
    sections.append(f"=== REAL-TIME MARKET DATA FOR {token.upper()} ===")
    sections.append(f"Data fetched at current timestamp. Use these REAL numbers in your analysis.\n")
    
    # Track which sources were used
    sources = []
    
    # --- CoinGecko ---
    if cg_data:
        sources.append("CoinGecko")
        sections.append("--- PRICE & MARKET DATA (Source: CoinGecko) ---")
        
        if cg_data["current_price_usd"]:
            sections.append(f"Current Price: ${cg_data['current_price_usd']:,.6f}")
        if cg_data["market_cap_usd"]:
            sections.append(f"Market Cap: ${cg_data['market_cap_usd']:,.0f}")
        if cg_data["fully_diluted_valuation"]:
            sections.append(f"Fully Diluted Valuation (FDV): ${cg_data['fully_diluted_valuation']:,.0f}")
        if cg_data["mcap_fdv_ratio"]:
            sections.append(f"MC/FDV Ratio: {cg_data['mcap_fdv_ratio']}")
        if cg_data["total_volume_24h"]:
            sections.append(f"24h Volume: ${cg_data['total_volume_24h']:,.0f}")
        if cg_data["circulating_supply"]:
            sections.append(f"Circulating Supply: {cg_data['circulating_supply']:,.0f}")
        if cg_data["total_supply"]:
            sections.append(f"Total Supply: {cg_data['total_supply']:,.0f}")
        if cg_data["max_supply"]:
            sections.append(f"Max Supply: {cg_data['max_supply']:,.0f}")
        
        sections.append("")
        sections.append("--- PRICE CHANGES ---")
        if cg_data["price_change_24h_pct"] is not None:
            sections.append(f"24h Change: {cg_data['price_change_24h_pct']:+.2f}%")
        if cg_data["price_change_7d_pct"] is not None:
            sections.append(f"7d Change: {cg_data['price_change_7d_pct']:+.2f}%")
        if cg_data["price_change_30d_pct"] is not None:
            sections.append(f"30d Change: {cg_data['price_change_30d_pct']:+.2f}%")
        if cg_data["ath_usd"]:
            sections.append(f"All-Time High: ${cg_data['ath_usd']:,.6f} ({cg_data['ath_change_pct']:+.1f}% from ATH)")
        
        sections.append("")
        sections.append("--- COMMUNITY (Source: CoinGecko) ---")
        if cg_data["twitter_followers"]:
            sections.append(f"Twitter/X Followers: {cg_data['twitter_followers']:,}")
        if cg_data["reddit_subscribers"]:
            sections.append(f"Reddit Subscribers: {cg_data['reddit_subscribers']:,}")
        if cg_data["coingecko_rank"]:
            sections.append(f"CoinGecko Rank: #{cg_data['coingecko_rank']}")
        if cg_data["categories"]:
            sections.append(f"Categories: {', '.join(cg_data['categories'][:5])}")
    
    # --- DeFiLlama ---
    if dl_data:
        sources.append("DeFiLlama")
        sections.append("")
        sections.append("--- PROTOCOL / TVL DATA (Source: DeFiLlama) ---")
        if dl_data["tvl"]:
            sections.append(f"Total Value Locked (TVL): ${dl_data['tvl']:,.0f}")
        if dl_data["category"]:
            sections.append(f"Protocol Category: {dl_data['category']}")
        if dl_data["chains"]:
            sections.append(f"Active Chains: {', '.join(dl_data['chains'][:5])}")
        if dl_data["change_1d"] is not None:
            sections.append(f"TVL Change (24h): {dl_data['change_1d']:+.2f}%")
        if dl_data["change_7d"] is not None:
            sections.append(f"TVL Change (7d): {dl_data['change_7d']:+.2f}%")
    
    # --- Birdeye ---
    if be_data:
        sources.append("Birdeye")
        sections.append("")
        sections.append("--- SOLANA ON-CHAIN DATA (Source: Birdeye) ---")
        if be_data.get("holder_count"):
            sections.append(f"Token Holders: {be_data['holder_count']:,}")
        if be_data.get("unique_wallet_24h"):
            sections.append(f"Unique Wallets (24h): {be_data['unique_wallet_24h']:,}")
        if be_data.get("unique_wallet_30d"):
            sections.append(f"Unique Wallets (30d): {be_data['unique_wallet_30d']:,}")
        if be_data.get("trade_24h"):
            sections.append(f"Trades (24h): {be_data['trade_24h']:,}")
        if be_data.get("trade_30d"):
            sections.append(f"Trades (30d): {be_data['trade_30d']:,}")
        if be_data.get("liquidity_usd"):
            sections.append(f"DEX Liquidity: ${be_data['liquidity_usd']:,.0f}")
        if be_data.get("volume_24h_usd"):
            sections.append(f"DEX Volume (24h): ${be_data['volume_24h_usd']:,.0f}")
        
        # Security flags
        sec_flags = []
        if be_data.get("top10_holder_pct"):
            sections.append(f"Top 10 Holder Concentration: {be_data['top10_holder_pct']:.1f}%")
        if be_data.get("freeze_authority"):
            sec_flags.append("⚠️ Freeze authority is ENABLED")
        if be_data.get("mint_authority"):
            sec_flags.append("⚠️ Metadata is MUTABLE")
        if sec_flags:
            sections.append("Security Flags: " + " | ".join(sec_flags))
    
    # --- LunarCrush ---
    if lc_data:
        sources.append("LunarCrush")
        sections.append("")
        sections.append("--- SOCIAL SENTIMENT DATA (Source: LunarCrush) ---")
        if lc_data.get("galaxy_score"):
            sections.append(f"Galaxy Score (overall): {lc_data['galaxy_score']}/100")
        if lc_data.get("alt_rank"):
            sections.append(f"AltRank™ (vs all coins): #{lc_data['alt_rank']}")
        if lc_data.get("social_volume"):
            sections.append(f"Social Volume (total posts): {lc_data['social_volume']:,}")
        if lc_data.get("social_mentions_24h"):
            sections.append(f"Social Mentions (24h): {lc_data['social_mentions_24h']:,}")
        if lc_data.get("social_contributors"):
            sections.append(f"Unique Social Contributors: {lc_data['social_contributors']:,}")
        if lc_data.get("social_dominance"):
            sections.append(f"Social Dominance: {lc_data['social_dominance']:.2f}%")
        if lc_data.get("bullish_sentiment") is not None:
            sections.append(f"Bullish Sentiment: {lc_data['bullish_sentiment']:.0f}%")
        if lc_data.get("bearish_sentiment") is not None:
            sections.append(f"Bearish Sentiment: {lc_data['bearish_sentiment']:.0f}%")
        if lc_data.get("twitter_volume"):
            sections.append(f"Twitter/X Post Volume: {lc_data['twitter_volume']:,}")
        if lc_data.get("reddit_volume"):
            sections.append(f"Reddit Post Volume: {lc_data['reddit_volume']:,}")
        if lc_data.get("news_articles"):
            sections.append(f"News Articles: {lc_data['news_articles']}")
    
    # Source attribution
    sections.append(f"\n--- DATA SOURCES USED: {', '.join(sources)} ---")
    
    # Warn about missing sources
    missing = []
    if not be_data:
        missing.append("Birdeye (set BIRDEYE_API_KEY for Solana on-chain data)")
    if not lc_data:
        missing.append("LunarCrush (set LUNARCRUSH_API_KEY for social sentiment)")
    if missing:
        sections.append(f"⚠️ UNAVAILABLE SOURCES: {'; '.join(missing)}")
        sections.append("For data from unavailable sources, clearly state 'data not available' rather than estimating.")
    
    sections.append("\n=== END OF MARKET DATA ===")
    
    return "\n".join(sections)


# Quick test
if __name__ == "__main__":
    import sys
    import io
    from dotenv import load_dotenv
    load_dotenv()
    
    # Fix Windows encoding
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    
    token = sys.argv[1] if len(sys.argv) > 1 else "SOL"
    print(f"\nFetching data for {token}...\n")
    print(format_market_data_for_agents(token))
