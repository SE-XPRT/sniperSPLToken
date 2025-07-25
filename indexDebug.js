import dotenv from 'dotenv';
import fetchNewToken from './fetchNewToken.js';
import sendTelegramMessage from './sendTelegramMessage.js';
import getTokenInfo from './getTokenInfo.js';
import { LAST_LOT } from './fetchNewToken.js';
import fs from 'fs';

dotenv.config();

const SEEN_FILE = 'seenTokens.json';

function loadSeenTokens() {
    if (!fs.existsSync(SEEN_FILE)) {
        console.log('📁 Aucun fichier seenTokens.json trouvé, création d\'une nouvelle liste');
        return [];
    }
    const data = fs.readFileSync(SEEN_FILE, 'utf8');
    const seen = JSON.parse(data);
    console.log(`📁 ${seen.length} tokens déjà vus chargés`);
    return seen;
}

function saveSeenTokens(tokens) {
    fs.writeFileSync(SEEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
    console.log(`💾 ${tokens.length} tokens sauvegardés`);
}

async function run() {
    console.log("=== 🚀 DÉBUT DU SCAN ===");
    const seen = loadSeenTokens();
    
    try {
        const tokens = await fetchNewToken();
        console.log(`\n🔍 ${tokens.length} tokens récupérés de l'API`);
        
        let newTokensFound = 0;
        
        for (const token of tokens) {
            if (!seen.includes(token.mint)) {
                console.log(`\n🆕 NOUVEAU TOKEN TROUVÉ: ${token.mint}`);
                console.log(`   Nom: ${token.name || 'Unknown'}`);
                console.log(`   Symbole: ${token.symbol || 'Unknown'}`);
                
                // Marquer comme vu immédiatement
                seen.push(token.mint);
                saveSeenTokens(seen);
                newTokensFound++;
                
                // Envoyer le message Telegram de base d'abord
                const basicMsg = `🚀 *Nouveau Token Détecté!*

📛 *Nom*: ${token.name || 'Unknown'}
🔤 *Symbole*: ${token.symbol || 'Unknown'} 
📍 *Mint*: \`${token.mint}\`

🔗 [Voir sur Solscan](https://solscan.io/token/${token.mint})`;

                console.log('📤 Envoi du message Telegram...');
                await sendTelegramMessage(basicMsg);
                
                // Pause entre les messages
                if (newTokensFound >= 3) {
                    console.log('⏸️ Limite de 3 nouveaux tokens atteinte pour ce scan');
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.log(`✅ Token déjà vu: ${token.mint}`);
            }
        }
        
        if (newTokensFound === 0) {
            console.log('😴 Aucun nouveau token trouvé dans ce scan');
        } else {
            console.log(`\n🎉 ${newTokensFound} nouveaux tokens traités!`);
        }
        
    } catch (error) {
        console.error('❌ Erreur dans le scan:', error.message);
    }
    
    console.log("=== ✅ FIN DU SCAN ===\n");
}

// Lancer immédiatement
console.log('🤖 Démarrage du bot de détection de tokens...\n');
run();

// Puis toutes les 60 secondes
setInterval(run, 60000);
