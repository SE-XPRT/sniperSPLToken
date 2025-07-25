import fetchNewToken from './fetchNewToken.js';

async function test() {
    try {
        console.log('🚀 Testing new Jupiter API token detection...\n');
        const tokens = await fetchNewToken();
        
        console.log(`\n✅ Found ${tokens.length} tokens`);
        
        if (tokens.length > 0) {
            console.log('\n📊 Sample token data:');
            const sample = tokens[0];
            console.log(`Token: ${sample.symbol} (${sample.name})`);
            console.log(`Price: ${sample.price}`);
            console.log(`Market Cap: ${sample.marketCap}`);
            console.log(`Holders: ${sample.holders}`);
            console.log(`Liquidity: ${sample.liquidity}`);
            console.log(`Sniping Score: ${sample.snipingScore}/100 (${sample.riskLevel})`);
            console.log(`Security: Mint=${sample.mintDisabled}, Freeze=${sample.freezeDisabled}`);
            console.log(`Trading: ${sample.buys5m} buys, ${sample.sells5m} sells in 5m`);
        }
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

test();
