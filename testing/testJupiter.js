import axios from 'axios';

async function testJupiterAPI() {
    try {
        console.log('🚀 Testing Jupiter Recent Tokens API...\n');
        
        const response = await axios.get('https://lite-api.jup.ag/tokens/v2/recent');
        
        console.log(`✅ Response received with ${response.data.length} tokens`);
        
        if (response.data.length > 0) {
            const token = response.data[0];
            console.log('\n📊 Sample token structure:');
            console.log(`- ID: ${token.id}`);
            console.log(`- Name: ${token.name}`);
            console.log(`- Symbol: ${token.symbol}`);
            console.log(`- Price: $${token.usdPrice?.toFixed(10) || 'N/A'}`);
            console.log(`- Market Cap: $${token.mcap || 'N/A'}`);
            console.log(`- Holders: ${token.holderCount || 'N/A'}`);
            console.log(`- Liquidity: $${token.liquidity || 'N/A'}`);
            console.log(`- Organic Score: ${token.organicScore || 'N/A'}`);
            console.log(`- Launchpad: ${token.launchpad || 'N/A'}`);
            
            if (token.audit) {
                console.log('\n🔒 Audit Info:');
                console.log(`- Mint Authority Disabled: ${token.audit.mintAuthorityDisabled}`);
                console.log(`- Freeze Authority Disabled: ${token.audit.freezeAuthorityDisabled}`);
                console.log(`- Is Suspicious: ${token.audit.isSus}`);
                console.log(`- Dev Balance %: ${token.audit.devBalancePercentage}%`);
            }
            
            if (token.stats5m) {
                console.log('\n📈 5min Stats:');
                console.log(`- Buy Volume: $${token.stats5m.buyVolume}`);
                console.log(`- Num Buys: ${token.stats5m.numBuys}`);
                console.log(`- Num Sells: ${token.stats5m.numSells}`);
                console.log(`- Price Change: ${token.stats5m.priceChange}%`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testJupiterAPI();
