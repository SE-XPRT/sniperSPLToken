// Récupère les tokens récents Jupiter et enrichit avec DexScreener
export async function fetchRecentJupiterTokensWithDexData(limit = 10) {
    // 1. Fetch tokens récents Jupiter
    const jupiterUrl = 'https://lite-api.jup.ag/tokens/v2/recent';
    let tokens = [];
    try {
        const res = await axios.get(jupiterUrl);
        tokens = res.data?.tokens || [];
        if (limit > 0) tokens = tokens.slice(0, limit);
        console.log(`✅ Fetched ${tokens.length} recent tokens from Jupiter.`);
    } catch (err) {
        console.error('❌ Error fetching Jupiter tokens:', err.message);
        return [];
    }

    // 2. Pour chaque token, fetch DexScreener
    const enriched = await Promise.all(tokens.map(async (token) => {
        let dexData = null;
        try {
            const dexRes = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${token.id}`);
            dexData = dexRes.data;
        } catch (e) {
            // Pas de data DexScreener
        }

        // Extraction des infos DexScreener principales
        let dexInfo = {};
        if (dexData?.pairs && dexData.pairs.length > 0) {
            const pair = dexData.pairs[0];
            dexInfo = {
                dexPrice: pair.priceUsd ? `$${pair.priceUsd}` : 'N/A',
                dexMarketCap: pair.marketCap ? `$${Number(pair.marketCap).toLocaleString()}` : 'N/A',
                dexLiquidity: pair.liquidity?.usd ? `$${Number(pair.liquidity.usd).toLocaleString()}` : 'N/A',
                dexVolume24h: pair.volume?.h24 ? `$${Number(pair.volume.h24).toLocaleString()}` : 'N/A',
                dexName: pair.baseToken?.name || 'Unknown',
                dexSymbol: pair.baseToken?.symbol || 'Unknown',
            };
        }

        return {
            ...token,
            ...dexInfo,
            hasDexData: !!(dexData?.pairs && dexData.pairs.length > 0),
            rawDex: dexData
        };
    }));

    return enriched;
}
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

async function getTokenInfo(mintAddress) {
    console.log(`\n=== FETCHING TOKEN INFO FOR: ${mintAddress} ===`);
    
    try {
        // 1. Récupérer les informations de base du token via Helius
        console.log('📡 Fetching basic token info from Helius...');
        const tokenInfoUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
        
        const tokenInfoResponse = await axios.post(tokenInfoUrl, {
            jsonrpc: '2.0',
            id: 'token-info',
            method: 'getAccountInfo',
            params: [
                mintAddress,
                { encoding: 'jsonParsed' }
            ]
        });

        console.log('✅ Helius token info response:', JSON.stringify(tokenInfoResponse.data, null, 2));

        // 2. Récupérer les données Jupiter (plus complètes)
        console.log('🪐 Fetching token data from Jupiter...');
        let jupiterData = null;
        try {
            const jupiterResponse = await axios.get(`https://price.jup.ag/v4/price?ids=${mintAddress}`);
            jupiterData = jupiterResponse.data.data?.[mintAddress];
            console.log('✅ Jupiter price data:', JSON.stringify(jupiterData, null, 2));
        } catch (jupiterError) {
            console.log('❌ Jupiter price not available:', jupiterError.message);
        }

        // 3. Récupérer les métadonnées du token via Jupiter Token List
        console.log('📋 Fetching token metadata from Jupiter...');
        let tokenMetadata = null;
        try {
            const metadataResponse = await axios.get('https://token.jup.ag/all');
            const allTokens = metadataResponse.data;
            tokenMetadata = allTokens.find(token => token.address === mintAddress);
            if (tokenMetadata) {
                console.log('✅ Token metadata found:', JSON.stringify(tokenMetadata, null, 2));
            } else {
                console.log('❌ Token metadata not found in Jupiter list');
            }
        } catch (metadataError) {
            console.log('❌ Token metadata not available:', metadataError.message);
        }

        // 4. Récupérer le nombre de holders
        console.log('👥 Fetching holders count...');
        let holders = 0;
        try {
            const holdersResponse = await axios.post(tokenInfoUrl, {
                jsonrpc: '2.0',
                id: 'token-holders',
                method: 'getProgramAccounts',
                params: [
                    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                    {
                        encoding: 'jsonParsed',
                        filters: [
                            {
                                memcmp: {
                                    offset: 0,
                                    bytes: mintAddress
                                }
                            },
                            {
                                dataSize: 165
                            }
                        ]
                    }
                ]
            });

            console.log('Holders response:', JSON.stringify(holdersResponse.data, null, 2));
            holders = holdersResponse.data.result ? holdersResponse.data.result.length : 0;
            console.log(`✅ Holders count: ${holders}`);
        } catch (holdersError) {
            console.log('❌ Error fetching holders:', holdersError.message);
        }

        // 5. Vérifier les données via DexScreener
        console.log('📈 Fetching DexScreener data...');
        let dexData = null;
        try {
            const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
            dexData = dexResponse.data;
            console.log('✅ DexScreener data:', JSON.stringify(dexData, null, 2));
        } catch (dexError) {
            console.log('❌ DexScreener data not available:', dexError.message);
        }

        // 6. Compiler les informations
        let price = 'N/A';
        let marketCap = 'N/A';
        let liquidity = 'N/A';
        let volume24h = 'N/A';
        let tokenName = 'Unknown';
        let tokenSymbol = 'Unknown';

        // Priorité Jupiter > DexScreener pour le prix
        if (jupiterData && jupiterData.price) {
            price = `$${Number(jupiterData.price).toFixed(8)}`;
            console.log(`Using Jupiter price: ${price}`);
        } else if (dexData?.pairs && dexData.pairs.length > 0) {
            const pair = dexData.pairs[0];
            price = pair.priceUsd ? `$${pair.priceUsd}` : 'N/A';
            marketCap = pair.marketCap ? `$${Number(pair.marketCap).toLocaleString()}` : 'N/A';
            liquidity = pair.liquidity?.usd ? `$${Number(pair.liquidity.usd).toLocaleString()}` : 'N/A';
            volume24h = pair.volume?.h24 ? `$${Number(pair.volume.h24).toLocaleString()}` : 'N/A';
            console.log(`Using DexScreener data - Price: ${price}, MC: ${marketCap}, Liquidity: ${liquidity}`);
        }

        // Métadonnées du token
        if (tokenMetadata) {
            tokenName = tokenMetadata.name || 'Unknown';
            tokenSymbol = tokenMetadata.symbol || 'Unknown';
            console.log(`Using Jupiter metadata - Name: ${tokenName}, Symbol: ${tokenSymbol}`);
        } else if (dexData?.pairs && dexData.pairs.length > 0) {
            tokenName = dexData.pairs[0].baseToken?.name || 'Unknown';
            tokenSymbol = dexData.pairs[0].baseToken?.symbol || 'Unknown';
            console.log(`Using DexScreener metadata - Name: ${tokenName}, Symbol: ${tokenSymbol}`);
        }

        // 7. Vérification anti-honeypot
        console.log('🛡️ Checking honeypot status...');
        const isHoneypot = await checkHoneypot(mintAddress, holders);

        const result = {
            mintAddress,
            name: tokenName,
            symbol: tokenSymbol,
            holders,
            price,
            marketCap,
            liquidity,
            volume24h,
            isHoneypot,
            hasJupiterData: !!(jupiterData && jupiterData.price),
            hasDexData: !!(dexData?.pairs && dexData.pairs.length > 0),
            hasMetadata: !!tokenMetadata
        };

        console.log('🎉 Final token info:', JSON.stringify(result, null, 2));
        console.log(`=== END TOKEN INFO FOR: ${mintAddress} ===\n`);

        return result;

    } catch (error) {
        console.error('❌ Error getting token info:', error.message);
        console.log(`=== ERROR END FOR: ${mintAddress} ===\n`);
        
        return {
            mintAddress,
            name: 'Unknown',
            symbol: 'Unknown',
            holders: 0,
            price: 'N/A',
            marketCap: 'N/A',
            liquidity: 'N/A',
            volume24h: 'N/A',
            isHoneypot: 'Unknown',
            hasJupiterData: false,
            hasDexData: false,
            hasMetadata: false,
            error: error.message
        };
    }
}

export async function checkHoneypot(mintAddress, holders) {
    try {
        console.log(`🔍 Starting honeypot check for token ${mintAddress}...`);

        // Vérification : type de holders
        if (typeof holders !== 'number') {
            console.warn(`⚠️ Invalid holders count: ${holders}`);
            return '❓ UNKNOWN (Invalid holders count)';
        }

        // Cas très suspect : aucun holder
        if (holders === 0) {
            console.log('⚠️ No holders found - Very suspicious');
            return '🚨 VERY SUSPICIOUS (No holders)';
        }

        // Cas suspect : peu de holders
        if (holders < 10) {
            console.log(`⚠️ Very few holders (${holders}) - Suspicious`);
            return '🚨 SUSPICIOUS (Few holders)';
        }

        // Cas classique : probablement OK
        console.log(`✅ Token seems fine (${holders} holders)`);
        return '✅ PROBABLY OK';
    }
    catch (error) {
        console.error('❌ Error checking honeypot:', error.message || error);
        return '❓ UNKNOWN (Error)';
    }
}

export default getTokenInfo;
