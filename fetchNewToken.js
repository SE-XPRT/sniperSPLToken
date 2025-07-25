import axios from 'axios';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const LAST_LOT = Date.now();

// Fonction pour analyser les métriques de sniping
function analyzeSnipingMetrics(token) {
    let score = 0;
    let reasons = [];
    let riskLevel = 'HIGH';

    // 1. Analyse de la sécurité (30 points max)
    if (token.audit?.mintAuthorityDisabled) {
        score += 10;
        reasons.push('✅ Mint disabled');
    }
    if (token.audit?.freezeAuthorityDisabled) {
        score += 10;
        reasons.push('✅ Freeze disabled');
    }
    if (!token.audit?.isSus) {
        score += 10;
        reasons.push('✅ Not flagged as suspicious');
    }

    // 2. Analyse de la liquidité et volume (25 points max)
    if (token.liquidity && token.liquidity > 1000) {
        score += 15;
        reasons.push('💧 Good liquidity');
    }
    if (token.stats5m?.buyVolume && token.stats5m.buyVolume > 100) {
        score += 10;
        reasons.push('📈 Active trading');
    }

    // 3. Analyse des holders (20 points max)
    const holders = token.holderCount || 0;
    if (holders >= 10 && holders <= 50) {
        score += 20;
        reasons.push('👥 Optimal holder range');
    } else if (holders > 50) {
        score += 10;
        reasons.push('👥 Many holders');
    }

    // 4. Analyse du dev et distribution (15 points max)
    const devBalance = token.audit?.devBalancePercentage || 0;
    if (devBalance < 5) {
        score += 15;
        reasons.push('✅ Low dev allocation');
    } else if (devBalance < 10) {
        score += 8;
        reasons.push('⚠️ Moderate dev allocation');
    }

    // 5. Analyse du momentum (10 points max)
    if (token.stats5m?.priceChange && token.stats5m.priceChange > 0) {
        score += 5;
        reasons.push('🚀 Price trending up');
    }
    if (token.stats5m?.numBuys > token.stats5m?.numSells) {
        score += 5;
        reasons.push('📊 More buys than sells');
    }

    // Déterminer le niveau de risque
    if (score >= 70) riskLevel = 'LOW';
    else if (score >= 50) riskLevel = 'MEDIUM';
    else if (score >= 30) riskLevel = 'HIGH';
    else riskLevel = 'VERY HIGH';

    return {
        score,
        reason: reasons.join(', ') || 'No positive signals',
        riskLevel
    };
}

async function fetchNewToken() {
    console.log('🔍 Fetching REAL new tokens from Jupiter Recent API...');
    
    try {
        // Utiliser l'API Jupiter Recent - tokens vraiment nouveaux
        const response = await axios.get('https://lite-api.jup.ag/tokens/v2/recent');
        
        if (!response.data || !Array.isArray(response.data)) {
            console.log('❌ Invalid response from Jupiter Recent API');
            return [];
        }

        console.log(`✅ Found ${response.data.length} recent tokens from Jupiter`);
        
        // Filtrer et analyser les tokens pour le sniping
        const recentTokens = response.data
            .filter(token => {
                // Filtres de base
                if (!token.id || !token.name || !token.symbol) return false;
                
                // Filtrer les tokens suspects
                if (token.audit?.isSus) {
                    console.log(`⚠️ Skipping suspicious token: ${token.symbol}`);
                    return false;
                }
                
                return true;
            })
            .slice(0, 15) // Prendre les 15 plus récents
            .map(token => {
                // Analyser les métriques pour le sniping
                const snipingMetrics = analyzeSnipingMetrics(token);
                
                return {
                    mint: token.id,
                    name: token.name,
                    symbol: token.symbol,
                    
                    // Données essentielles pour le sniping
                    launchpad: token.launchpad || 'Unknown',
                    metaLaunchpad: token.metaLaunchpad || null,
                    createdAt: token.firstPool?.createdAt || null,
                    
                    // Métriques financières
                    price: token.usdPrice ? `$${token.usdPrice.toFixed(10)}` : 'N/A',
                    marketCap: token.mcap ? `$${Math.round(token.mcap)}` : 'N/A',
                    fdv: token.fdv ? `$${Math.round(token.fdv)}` : 'N/A',
                    liquidity: token.liquidity ? `$${Math.round(token.liquidity)}` : 'N/A',
                    
                    // Données de trading
                    holders: token.holderCount || 0,
                    volume5m: token.stats5m?.buyVolume ? `$${Math.round(token.stats5m.buyVolume)}` : 'N/A',
                    buys5m: token.stats5m?.numBuys || 0,
                    sells5m: token.stats5m?.numSells || 0,
                    priceChange5m: token.stats5m?.priceChange ? `${token.stats5m.priceChange.toFixed(2)}%` : 'N/A',
                    
                    // Audit & Sécurité
                    mintDisabled: token.audit?.mintAuthorityDisabled || false,
                    freezeDisabled: token.audit?.freezeAuthorityDisabled || false,
                    topHoldersPercent: token.audit?.topHoldersPercentage ? `${token.audit.topHoldersPercentage.toFixed(2)}%` : 'N/A',
                    devBalance: token.audit?.devBalancePercentage ? `${token.audit.devBalancePercentage.toFixed(2)}%` : 'N/A',
                    
                    // Score organique et tags
                    organicScore: token.organicScore || 0,
                    organicLabel: token.organicScoreLabel || 'unknown',
                    tags: token.tags || [],
                    
                    // Liens sociaux
                    website: token.website || null,
                    twitter: token.twitter || null,
                    telegram: token.telegram || null,
                    
                    // Métriques de sniping
                    snipingScore: snipingMetrics.score,
                    snipingReason: snipingMetrics.reason,
                    riskLevel: snipingMetrics.riskLevel,
                    
                    signature: 'jupiter_recent_api',
                    slot: Date.now(),
                    type: 'jupiter_recent'
                };
            });

        // Trier par score de sniping (meilleurs en premier)
        recentTokens.sort((a, b) => b.snipingScore - a.snipingScore);
        
        console.log(`\n🎯 TOP SNIPING OPPORTUNITIES:`);
        recentTokens.slice(0, 5).forEach((token, index) => {
            console.log(`${index + 1}. ${token.symbol} (${token.name})`);
            console.log(`   💰 Price: ${token.price} | MC: ${token.marketCap} | Holders: ${token.holders}`);
            console.log(`   🎯 Sniping Score: ${token.snipingScore}/100 (${token.riskLevel})`);
            console.log(`   📊 5m: ${token.buys5m} buys, ${token.priceChange5m} change`);
            console.log(`   ⚡ Reason: ${token.snipingReason}`);
            console.log(`   🔗 ${token.mint}\n`);
        });
        
        return recentTokens;
    } catch (error) {
        console.error('Error fetching new tokens:', error.message);
        throw error;
    }
}

async function fetchFromDexScreener() {
    try {
        console.log('� Fetching from DexScreener...');
        const response = await axios.get('https://api.dexscreener.com/latest/dex/tokens/solana');
        
        if (response.data && response.data.pairs) {
            return response.data.pairs
                .filter(pair => pair.baseToken && pair.baseToken.address !== 'So11111111111111111111111111111111111111112')
                .slice(0, 5)
                .map(pair => ({
                    mint: pair.baseToken.address,
                    name: pair.baseToken.name || 'Unknown',
                    symbol: pair.baseToken.symbol || 'Unknown',
                    signature: 'dexscreener_api',
                    slot: Date.now(),
                    type: 'from_dexscreener'
                }));
        }
        return [];
    } catch (error) {
        console.log('❌ DexScreener fetch failed:', error.message);
        return [];
    }
}

async function fetchFromHelius() {
    try {
        console.log('⚡ Fetching from Helius...');
        if (!HELIUS_API_KEY) {
            console.log('❌ No Helius API key available');
            return [];
        }
        
        const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
        const response = await axios.post(url, {
            jsonrpc: '2.0',
            id: 'search-assets',
            method: 'searchAssets',
            params: {
                limit: 5,
                page: 1,
                sortBy: {
                    sortBy: 'created',
                    sortDirection: 'desc'
                }
            }
        });

        if (response.data.result && response.data.result.items) {
            return response.data.result.items
                .filter(item => item.id !== 'So11111111111111111111111111111111111111112')
                .map(item => ({
                    mint: item.id,
                    name: item.content?.metadata?.name || 'Unknown',
                    symbol: item.content?.metadata?.symbol || 'Unknown',
                    signature: 'helius_search',
                    slot: Date.now(),
                    type: 'from_helius_search'
                }));
        }
        return [];
    } catch (error) {
        console.log('❌ Helius search failed:', error.message);
        return [];
    }
}

export default fetchNewToken;
export { LAST_LOT };