import dotenv from 'dotenv';
import fetchNewToken from './fetchNewToken.js';
import {sendTelegramMessage}  from './sendTelegramMessage.js';
const BOT_USERNAME = "SniperSPLToken_bot";

import getTokenInfo from './getTokenInfo.js';
import axios from 'axios';
// Timeout global pour axios (10 secondes)
axios.defaults.timeout = 10000;

// Handler global pour éviter les crashs sur erreurs non catchées
process.on('unhandledRejection', (reason, p) => {
    console.error('❌ Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});
import { LAST_LOT } from './fetchNewToken.js';
import fs from 'fs';

dotenv.config();

const SEEN_FILE = 'seenTokens.json';

function loadSeenTokens() {
    if (!fs.existsSync(SEEN_FILE)) {
        return [];
    }
    const data = fs.readFileSync(SEEN_FILE, 'utf8');
    return JSON.parse(data);
}

function saveSeenTokens(tokens) {
    fs.writeFileSync(SEEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

async function run() {
    console.log("Fetching new tokens...");
    const seen = loadSeenTokens();
    const tokens = await fetchNewToken();

    for (const token of tokens) {
        if (!seen.includes(token.mint)) {
            try {
                console.log(`New token found: ${token.mint}`);
                seen.push(token.mint);
                saveSeenTokens(seen);

                // Récupérer les informations détaillées du token
                console.log(`Getting token info for: ${token.mint}`);
                const tokenInfo = await getTokenInfo(token.mint);

                // Helper pour échapper MarkdownV2
                function esc(str) {
                    return String(str).replace(/[\\_\*\[\]\(\)~`>#+\-=|{}.!]/g, x => '\\' + x);
                }
                const msg =
                    `🚀 *New SPL Token Detected\\!*\n\n` +
                    `📛 *Name*: ${esc(tokenInfo.name)}\n` +
                    `🔤 *Symbol*: ${esc(tokenInfo.symbol)}\n` +
                    `📍 *Mint*: \`${esc(token.mint)}\`\n\n` +
                    `👥 *Holders*: ${esc(tokenInfo.holders)}\n` +
                    `💰 *Price*: ${esc(tokenInfo.price)}\n` +
                    `📊 *Market Cap*: ${esc(tokenInfo.marketCap)}\n` +
                    `💧 *Liquidity*: ${esc(tokenInfo.liquidity)}\n` +
                    `📈 *Volume 24h*: ${esc(tokenInfo.volume24h)}\n` +
                    `🛡️ *Security*: ${esc(tokenInfo.isHoneypot)}\n\n` +
                    `📊 *Data Sources*:\n` +
                    `${tokenInfo.hasJupiterData ? '✅' : '❌'} Jupiter\n` +
                    `${tokenInfo.hasDexData ? '✅' : '❌'} DexScreener\n` +
                    `${tokenInfo.hasMetadata ? '✅' : '❌'} Metadata\n\n` +
                    `⏰ *Detected*: ${esc(new Date(LAST_LOT).toLocaleString())}\n\n` +
                    `🔗 [Solscan](https://solscan.io/token/${esc(token.mint)})\n` +
                    `🪐 [Jupiter](https://jup.ag/tokens/${esc(token.mint)})`;

                // Ajout d'un bouton Go Bot si le username est défini
                if (BOT_USERNAME) {
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
                    console.log(`Telegram message with Go Bot button sent for token: ${token.mint}`);
                } else {
                    await sendTelegramMessage(msg, { parse_mode: 'MarkdownV2', disable_web_page_preview: true });
                    console.log(`Telegram message sent for token: ${token.mint}`);
                }
                // Petite pause entre les tokens pour éviter le spam
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
                console.error(`❌ Error processing token ${token.mint}:`, err);
            }
        }
    }
    saveSeenTokens(seen);
}

// Lancer immédiatement puis toutes les 30 secondes
run();
setInterval(run, 30000);