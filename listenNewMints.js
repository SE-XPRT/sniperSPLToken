import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import getTokenInfo from './getTokenInfo.js';
import { sendTelegramMessage } from './sendTelegramMessage.js';

// --- CONFIG ---
const WS_ENDPOINT = clusterApiUrl('mainnet-beta'); // Peut être remplacé par un endpoint Helius/QuickNode WebSocket
const BOT_USERNAME = "SniperSPLToken_bot";

// Pour éviter les doublons
const seenMints = new Set();

// Helper pour échapper MarkdownV2
function esc(str) {
    return String(str).replace(/[\\_\*\[\]\(\)~`>#+\-=|{}.!]/g, x => '\\' + x);
}

async function handleNewMint(mintAddress) {
    if (seenMints.has(mintAddress)) return;
    seenMints.add(mintAddress);
    console.log(`🆕 New SPL Mint detected: ${mintAddress}`);
    try {
        const tokenInfo = await getTokenInfo(mintAddress);
        const msg =
            `🚀 *New SPL Token Detected\\!*\n\n` +
            `📛 *Name*: ${esc(tokenInfo.name)}\n` +
            `🔤 *Symbol*: ${esc(tokenInfo.symbol)}\n` +
            `📍 *Mint*: \`${esc(mintAddress)}\`\n\n` +
            `👥 *Holders*: ${esc(tokenInfo.holders)}\n` +
            `💰 *Price*: ${esc(tokenInfo.price)}\n` +
            `📊 *Market Cap*: ${esc(tokenInfo.marketCap)}\n` +
            `💧 *Liquidity*: ${esc(tokenInfo.liquidity)}\n` +
            `📈 *Volume 24h*: ${esc(tokenInfo.volume24h)}\n` +
            `🛡️ *Security*: ${esc(tokenInfo.isHoneypot)}\n\n` +
            `⏰ *Detected*: ${esc(new Date().toLocaleString())}\n\n` +
            `🔗 [Solscan](https://solscan.io/token/${esc(mintAddress)})\n` +
            `🪐 [Jupiter](https://jup.ag/tokens/${esc(mintAddress)})`;
        const reply_markup = {
            inline_keyboard: [
                [
                    {
                        text: '🤖 Go Bot',
                        url: `https://t.me/${BOT_USERNAME}`
                    }
                ]
            ]
        };
        await sendTelegramMessage(msg, { reply_markup, parse_mode: 'MarkdownV2', disable_web_page_preview: true });
        console.log(`✅ Telegram message sent for mint: ${mintAddress}`);
    } catch (e) {
        console.error(`❌ Error processing mint ${mintAddress}:`, e);
    }
}

export async function listenNewMints() {
    const connection = new Connection(WS_ENDPOINT, 'confirmed');
    console.log('🔌 Listening for new SPL token mints on Solana mainnet...');
    // Listen to all program account creations for SPL Token program
    const programId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    connection.onProgramAccountChange(
        programId,
        async (info) => {
            // Mint accounts have dataSize 82
            if (info.accountInfo.data.length === 82) {
                const mintAddress = info.accountId.toBase58();
                await handleNewMint(mintAddress);
            }
        },
        'confirmed',
        [{ dataSize: 82 }]
    );
}

// Pour lancer en standalone :
if (process.argv[1].endsWith('listenNewMints.js')) {
    listenNewMints();
}
