import sendTelegramMessage from './sendTelegramMessage.js';

console.log('🧪 Test d\'envoi d\'un message Telegram...\n');

const testMessage = `🚀 *Test - New SPL Token Detected!* 

📛 *Name*: Test Token
🔤 *Symbol*: TEST
📍 *Mint*: \`2hpyPyPa8AbgwA7nhyA6tFHGSNCxyZDDgk2kkAptYQw8\`

👥 *Holders*: 42
💰 *Price*: $0.00001234
📊 *Market Cap*: $123,456
💧 *Liquidity*: $50,000
📈 *Volume 24h*: $25,000
🛡️ *Security*: ✅ LIKELY SAFE

⏰ *Detected*: ${new Date().toLocaleString()}

🔗 [Solscan](https://solscan.io/token/2hpyPyPa8AbgwA7nhyA6tFHGSNCxyZDDgk2kkAptYQw8)
📈 [DexScreener](https://dexscreener.com/solana/2hpyPyPa8AbgwA7nhyA6tFHGSNCxyZDDgk2kkAptYQw8)`;

await sendTelegramMessage(testMessage);
console.log('\n✅ Test terminé !');
