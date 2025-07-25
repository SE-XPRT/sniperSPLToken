// ...existing code...
import TelegramBot from 'node-telegram-bot-api';
import { Connection, clusterApiUrl, Keypair, PublicKey, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import axios from "axios";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // ID de groupe autorisé


const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
// Stockage temporaire des clés privées par utilisateur (en mémoire)
const userWallets = {};

// /tokens command: affiche tous les tokens SPL du wallet connecté avec leur solde
bot.onText(/^\/tokens$/, async (msg) => {
    const chatId = msg.chat.id;
    const userKeypair = userWallets[chatId];
    if (!userKeypair) {
        return bot.sendMessage(chatId, '❌ Please connect your wallet first by sending your private key (in private chat).');
    }
    const pubkey = userKeypair.publicKey;
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') });
        let msgText = `📦 *SPL Tokens for* \`${pubkey.toBase58()}\`\n\n`;
        let found = false;
        for (const acc of tokenAccounts.value) {
            const info = acc.account.data.parsed.info;
            const mint = info.mint;
            const amount = info.tokenAmount.uiAmount;
            if (amount > 0) {
                found = true;
                msgText += `• \`${mint}\`\n  Balance: *${amount}*\n`;
            }
        }
        if (!found) msgText += 'Aucun token SPL trouvé.';
        bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, '❌ Error fetching SPL tokens: ' + e.message);
    }
});

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("❌ TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant dans .env");
} else {
    console.log(`📱 Telegram Config - Bot Token: ${TELEGRAM_BOT_TOKEN ? 'Présent' : 'Manquant'}`);
    console.log(`💬 Chat ID: ${TELEGRAM_CHAT_ID}`);
    
    // Vérifier le type de chat basé sur l'ID
    const chatIdNum = parseInt(TELEGRAM_CHAT_ID);
    if (chatIdNum > 0) {
        console.log('📱 Type: Chat privé');
    } else if (chatIdNum < -1000000000000) {
        console.log('👥 Type: Supergroupe');
    } else if (chatIdNum < 0) {
        console.log('👥 Type: Groupe normal');
    }
}

async function sendTelegramMessage(message, options = undefined) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    };
    if (options) {
        Object.assign(payload, options);
    }

    try {
        const response = await axios.post(url, payload);

        if (response.data.ok) {
            console.log(`✅ Message envoyé avec succès : ${message}`);
        } else {
            console.error("⚠️ Échec de l'envoi Telegram:", response.data.description);
        }

    } catch (error) {
        console.error("❌ Erreur lors de l'envoi Telegram:", error.response?.data || error.message);
    }
}

// Fonction pour obtenir les informations du bot et les chats disponibles
export async function getTelegramInfo() {
    try {
        console.log('🔍 Récupération des informations Telegram...');

        // 1. Obtenir les infos du bot
        const botInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
        const botResponse = await axios.get(botInfoUrl);
        console.log('🤖 Bot Info:', JSON.stringify(botResponse.data, null, 2));

        // 2. Obtenir les dernières updates pour voir les chats
        const updatesUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
        const updatesResponse = await axios.get(updatesUrl);
        console.log('📨 Recent Updates:', JSON.stringify(updatesResponse.data, null, 2));

        // 3. Extraire les chat IDs des messages reçus
        if (updatesResponse.data.ok && updatesResponse.data.result.length > 0) {
            console.log('\n📋 Chats disponibles:');
            updatesResponse.data.result.forEach(update => {
                if (update.message && update.message.chat) {
                    const chat = update.message.chat;
                    console.log(`- Chat ID: ${chat.id} | Type: ${chat.type} | Title/Name: ${chat.title || chat.username || chat.first_name || ''}`);
                }
            });
            console.log('\n📝 Pour configurer un GROUPE:');
            console.log('1. Créez un groupe Telegram');
            console.log('2. Ajoutez votre bot au groupe');
            console.log('3. Envoyez un message dans le groupe (par exemple "/start")');
            console.log('4. Relancez ce script pour voir le Chat ID du groupe');
            console.log('3. Utilisez le Chat ID négatif affiché ci-dessus dans votre .env');
            console.log('4. Format dans .env: TELEGRAM_CHAT_ID=-123456789');
        } else {
            console.log('❌ Aucun message récent trouvé.');
        }
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des infos Telegram:', error.response?.data || error.message);
    }
}

// --- Wallet connection support via /start ---

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') {
        return bot.sendMessage(
            chatId,
            "⚠️ For your security, wallet connection is only available in private chat.\n\n➡️ Please DM me directly to connect your wallet.",
            { parse_mode: 'Markdown' }
        );
    }
    bot.sendMessage(
        chatId,
        `👋 *Welcome ${msg.from.first_name || ''}*\n\n` +
        `*How to use this bot:*\n` +
        `1️⃣ Send your **Solana private key** (JSON array, 64 bytes) or your **base58 private key** to connect your wallet.\n` +
        `2️⃣ Use the menu or commands below to interact.\n\n` +
        `⚠️ *Never share your private key publicly. Only use this bot in private chat!*`,
        { parse_mode: 'Markdown' }
    );
    bot.sendMessage(
        chatId,
        `🧭 *Quick Menu*\n\n` +
        `• /tokens — Show your SPL tokens\n` +
        `• /buy <tokenMint> <amountSOL> — Buy SPL token\n` +
        `• /sell <tokenMint> <amountSOL> — Sell SPL token\n` +
        `• /help — Show all commands & info`,
        { parse_mode: 'Markdown' }
    );
});

// When a user sends a message (potentially the private key)
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore /start (avoid confusion)
    if (typeof text !== 'string' || text.startsWith("/")) return;

    // Only allow wallet connection in private chat
    if (msg.chat.type !== 'private') return;

    let keypair = null;
    // 1. Try JSON array
    try {
        const secretKey = JSON.parse(text);
        if (Array.isArray(secretKey) && secretKey.length === 64) {
            keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        }
    } catch (e) {
        // Not a JSON array, try base58
    }

    // 2. Try base58 if not already found
    if (!keypair) {
        try {
            const decoded = bs58.decode(text.trim());
            if (decoded.length === 64) {
                keypair = Keypair.fromSecretKey(decoded);
            }
        } catch (e) {
            // Not valid base58
        }
    }

    if (!keypair) {
        return bot.sendMessage(
            chatId,
            "❌ Invalid key format.\n\nPlease send a JSON array of 64 elements OR a base58 private key (64 bytes).\n\n*Never share your key in a group!*",
            { parse_mode: 'Markdown' }
        );
    }

    // If we reach here, the key is valid
    const pubkey = keypair.publicKey.toBase58();
    userWallets[chatId] = keypair;

    try {
        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const balanceSol = balanceLamports / 1e9;
        bot.sendMessage(
            chatId,
            `✅ Wallet connected: \`${pubkey}\`\n💰 Balance: *${balanceSol.toFixed(5)} SOL*`,
            { parse_mode: "Markdown" }
        );
    } catch (err) {
        bot.sendMessage(chatId, "⚠️ Error while fetching the balance. Please try again later.");
    }
});
// --- Fin ajout wallet ---

// --- Automated BUY function ---
export async function buy(tokenMint, userKeypair, options = {}) {
    try {
        // 1. Préparation quote Jupiter
        const amountSOL = options.amountSOL || 0.01;
        const amountLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
        const slippageBps = ((options.slippage || 1) * 100).toString();
        const FEE_BPS = 50; // 0.5% fee (50 basis points)
        const FEE_RECEIVER = '33tNJLpWG878xFRQLkNM3aDWz66U1sSwwFUe9AGF1WfA';
        const params = {
            inputMint: "So11111111111111111111111111111111111111112",
            outputMint: tokenMint,
            amount: amountLamports.toString(),
            slippageBps,
            onlyDirectRoutes: false,
            asLegacyTransaction: false,
        };
        let quoteRes;
        try {
            quoteRes = await axios.get('https://quote-api.jup.ag/v6/quote', { params });
        } catch (e) {
            return { success: false, reason: 'Jupiter quote API error', log: JSON.stringify(e?.response?.data || e.message) };
        }
        const quote = quoteRes.data;
        if (!quote || !quote.outAmount) {
            return { success: false, reason: "Failed to get quote", log: JSON.stringify(quote) };
        }

        // 2. Swap Jupiter avec feeDestination et feeBps
        const swapBody = {
            quoteResponse: quote,
            userPublicKey: userKeypair.publicKey.toBase58(),
            wrapUnwrapSOL: true,
            asLegacyTransaction: false,
            feeBps: FEE_BPS,
            feeDestination: FEE_RECEIVER,
        };
        let swapRes;
        try {
            swapRes = await axios.post('https://quote-api.jup.ag/v6/swap', swapBody, {
                headers: { "Content-Type": "application/json" }
            });
        } catch (e) {
            return { success: false, reason: 'Failed to get swap transaction from Jupiter', log: JSON.stringify(e?.response?.data || e.message) };
        }
        const swapTxB64 = swapRes.data.swapTransaction;
        if (!swapTxB64) {
            return { success: false, reason: "No transaction data", log: JSON.stringify(swapRes.data) };
        }

        // 3. Signature et envoi (VersionedTransaction Jupiter)
        try {
            const vtx = VersionedTransaction.deserialize(Buffer.from(swapTxB64, "base64"));
            vtx.sign([userKeypair]);
            const txSig = await connection.sendRawTransaction(vtx.serialize(), { skipPreflight: false });
            await connection.confirmTransaction(txSig, 'confirmed');
            // Décimales (devine)
            let decimals = 9;
            if (tokenMint === '8L8pDf3jutdpdr4m3np68CL9ZroLActrqwxi6s9Ah5xU' || tokenMint === 'Es9vMFrzaCER9Gk9a6QG1GzQ5oQ7h6vEihQ6bT1bQytS') decimals = 6;
            if (tokenMint === 'So11111111111111111111111111111111111111112') decimals = 9;
            return { success: true, signature: txSig, amount: quote.outAmount / (10 ** decimals), status: 'confirmed' };
        } catch (e) {
            return { success: false, reason: 'Failed to send or confirm transaction: ' + e.message };
        }
    } catch (e) {
        return { success: false, reason: e.message };
    }
}

// --- Automated SELL function ---
export async function sell(tokenMint, userKeypair, options = {}) {
    try {
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        const userPubkey = userKeypair.publicKey;
        // 1. Check user token balance
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(userPubkey, { mint: new PublicKey(tokenMint) });
        const accountInfo = tokenAccounts.value[0]?.account?.data?.parsed?.info;
        if (!accountInfo || Number(accountInfo.tokenAmount.amount) === 0) {
            return { success: false, reason: 'No token balance' };
        }
        const amount = Number(accountInfo.tokenAmount.amount);

        // 2. Quote Jupiter
        const params = {
            inputMint: tokenMint,
            outputMint: 'So11111111111111111111111111111111111111112',
            amount: amount.toString(),
            slippageBps: ((options.slippage || 1) * 100).toString(),
            onlyDirectRoutes: false,
            asLegacyTransaction: false,
        };
        let quoteRes;
        try {
            quoteRes = await axios.get('https://quote-api.jup.ag/v6/quote', { params });
        } catch (e) {
            return { success: false, reason: 'Jupiter quote API error', log: JSON.stringify(e?.response?.data || e.message) };
        }
        const quote = quoteRes.data;
        if (!quote || !quote.outAmount) {
            return { success: false, reason: "Failed to get quote", log: JSON.stringify(quote) };
        }

        // 3. Swap Jupiter
        const swapBody = {
            quoteResponse: quote,
            userPublicKey: userKeypair.publicKey.toBase58(),
            wrapUnwrapSOL: true,
            asLegacyTransaction: false,
        };
        let swapRes;
        try {
            swapRes = await axios.post('https://quote-api.jup.ag/v6/swap', swapBody, {
                headers: { "Content-Type": "application/json" }
            });
        } catch (e) {
            return { success: false, reason: 'Failed to get swap transaction from Jupiter', log: JSON.stringify(e?.response?.data || e.message) };
        }
        const swapTxB64 = swapRes.data.swapTransaction;
        if (!swapTxB64) {
            return { success: false, reason: "No transaction data", log: JSON.stringify(swapRes.data) };
        }

        // 4. Signature et envoi (VersionedTransaction Jupiter)
        try {
            const vtx = VersionedTransaction.deserialize(Buffer.from(swapTxB64, "base64"));
            vtx.sign([userKeypair]);
            const txSig = await connection.sendRawTransaction(vtx.serialize(), { skipPreflight: false });
            await connection.confirmTransaction(txSig, 'confirmed');
            return { success: true, signature: txSig, amount: quote.outAmount / LAMPORTS_PER_SOL, status: 'confirmed' };
        } catch (e) {
            return { success: false, reason: e.message };
        }
    } catch (e) {
        return { success: false, reason: e.message };
    }
}

// --- Telegram buy/sell command integration ---

// Helper: format filters for display
function formatFilters({minMarketCap, maxMarketCap, minVolume24h, maxHolders, minLiquidity, slippage}) {
    return [
        `MarketCap: [${minMarketCap ?? '-'} / ${maxMarketCap ?? '-'}]`,
        `Volume24h: ${minVolume24h ?? '-'}`,
        `Holders: ${maxHolders ?? '-'}`,
        `Liquidity: ${minLiquidity ?? '-'}`,
        `Slippage: ${slippage ?? 1}%`
    ].join('\n');
}

// /buy command with help and feedback
bot.onText(/^\/buy(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userKeypair = userWallets[chatId];

    // Help message if no arguments
    if (!match[1]) {
        return bot.sendMessage(
            chatId,
            `🛒 *How to use /buy*\n` +
            `\n*Usage:* \`/buy <tokenMint> <amountSOL> [minMC] [maxMC] [minVol] [maxHolders] [minLiq] [slippage]\`` +
            `\n\n*Example:* \`/buy 9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E 0.02 10000 50000 1000 500 1000 2\`` +
            `\n\n*Legend:*\n- tokenMint: SPL token address\n- amountSOL: amount in SOL to buy\n- minMC/maxMC: min/max marketcap\n- minVol: min 24h volume\n- maxHolders: max holders\n- minLiq: min liquidity\n- slippage: %\n\n` +
            `*You must connect your wallet first by sending your private key in private chat!*`,
            { parse_mode: "Markdown" }
        );
    }

    if (!userKeypair) {
        return bot.sendMessage(chatId, '❌ Please connect your wallet first by sending your private key (in private chat).');
    }

    const args = match[1].trim().split(/\s+/);
    const tokenMint = args[0];
    const amountSOL = parseFloat(args[1]) || 0.01;
    const minMarketCap = args[2] ? parseFloat(args[2]) : undefined;
    const maxMarketCap = args[3] ? parseFloat(args[3]) : undefined;
    const minVolume24h = args[4] ? parseFloat(args[4]) : undefined;
    const maxHolders = args[5] ? parseInt(args[5]) : undefined;
    const minLiquidity = args[6] ? parseFloat(args[6]) : undefined;
    const slippage = args[7] ? parseFloat(args[7]) : 1;

    bot.sendMessage(
        chatId,
        `⏳ Buying token: \`${tokenMint}\`\nAmount: *${amountSOL} SOL*\n${formatFilters({minMarketCap, maxMarketCap, minVolume24h, maxHolders, minLiquidity, slippage})}`,
        { parse_mode: "Markdown" }
    );

    const result = await buy(tokenMint, userKeypair, {
        minMarketCap,
        maxMarketCap,
        minVolume24h,
        maxHolders,
        minLiquidity,
        slippage,
        amountSOL
    });

    if (result.success) {
        bot.sendMessage(chatId, `✅ *Buy successful!*\n[View on Solscan](https://solscan.io/tx/${result.signature})\nAmount: *${result.amount}*`, { parse_mode: "Markdown" });
    } else {
        bot.sendMessage(chatId, `❌ *Buy failed:*\n${result.reason || "Unknown error"}`, { parse_mode: "Markdown" });
    }
});

// /sell command with help and feedback
bot.onText(/^\/sell(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userKeypair = userWallets[chatId];

    // Help message if no arguments
    if (!match[1]) {
        return bot.sendMessage(
            chatId,
            `💸 *How to use /sell*\n` +
            `\n*Usage:* \`/sell <tokenMint> [slippage]\`` +
            `\n\n*Example:* \`/sell 9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E 2\`` +
            `\n\n*Legend:*\n- tokenMint: SPL token address\n- slippage: % (default 1)\n\n` +
            `*You must connect your wallet first by sending your private key in private chat!*`,
            { parse_mode: "Markdown" }
        );
    }

    if (!userKeypair) {
        return bot.sendMessage(chatId, '❌ Please connect your wallet first by sending your private key (in private chat).');
    }

    const args = match[1].trim().split(/\s+/);
    const tokenMint = args[0];
    const slippage = args[1] ? parseFloat(args[1]) : 1;

    bot.sendMessage(chatId, `⏳ Selling token: \`${tokenMint}\`\nSlippage: ${slippage}%`, { parse_mode: "Markdown" });

    const result = await sell(tokenMint, userKeypair, { slippage });

    if (result.success) {
        bot.sendMessage(chatId, `✅ *Sell successful!*\n[View on Solscan](https://solscan.io/tx/${result.signature})\nAmount: *${result.amount}*`, { parse_mode: "Markdown" });
    } else {
        bot.sendMessage(chatId, `❌ *Sell failed:*\n${result.reason || "Unknown error"}`, { parse_mode: "Markdown" });
    }
});
// /help command
bot.onText(/^\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
        chatId,
        `🤖 *Bot Help & Commands*\n\n` +
        `*Wallet connection:*\n` +
        `- Send your Solana private key (JSON array or base58) in private chat to connect your wallet.\n` +
        `- *Never share your key in a group or channel!*\n\n` +
        `*Token list:*\n` +
        `- /tokens — Show all your SPL tokens and balances.\n\n` +
        `*Buy token:*\n` +
        `- /buy <tokenMint> <amountSOL> [minMC] [maxMC] [minVol] [maxHolders] [minLiq] [slippage]\n` +
        `- Example: /buy 9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E 0.02 10000 50000 1000 500 1000 2\n\n` +
        `*Sell token:*\n` +
        `- /sell <tokenMint> [slippage]\n` +
        `- Example: /sell 9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E 2\n\n` +
        `*Security tips:*\n` +
        `- Only use this bot in private chat.\n` +
        `- Never share your private key with anyone.\n\n` +
        `*Support:*\n` +
        `- For help, contact the bot admin.\n`,
        { parse_mode: "Markdown" }
    );
});
// --- End buy/sell integration ---
export { sendTelegramMessage};