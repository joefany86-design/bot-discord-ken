require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
global.client = client;

const economy = require('../stockmarket/economy');
const bank = require('../stockmarket/bank');

const GUILD_ID = '1410239829874053296';
const BOT_ID = '1498589959517507594'; // Sentinel bot ID

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch(); // Cache members
    console.log('✅ Guild members fetched and cached.');

    console.log('\n--- BEFORE RESET (Direct DB check) ---');
    const db = new Database(path.join(__dirname, '../data/economy.db'));
    const preWallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?').get(BOT_ID, GUILD_ID);
    const preSavings = db.prepare('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?').get(BOT_ID, GUILD_ID);
    console.log(`Pre-Wallet balance in DB: ${preWallet?.balance}`);
    console.log(`Pre-Savings balance in DB: ${preSavings?.balance}`);
    db.close();

    console.log('\n--- CALLING BUSINESS LOGIC (getWallet & getSavings) ---');
    const wallet = economy.getWallet(BOT_ID, GUILD_ID);
    const savings = bank.getSavings(BOT_ID, GUILD_ID);
    console.log(`Returned Wallet balance: ${wallet.balance}`);
    console.log(`Returned Savings balance: ${savings.balance}`);

    console.log('\n--- AFTER RESET (Direct DB check) ---');
    const dbPost = new Database(path.join(__dirname, '../data/economy.db'));
    const postWallet = dbPost.prepare('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?').get(BOT_ID, GUILD_ID);
    const postSavings = dbPost.prepare('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?').get(BOT_ID, GUILD_ID);
    console.log(`Post-Wallet balance in DB: ${postWallet?.balance}`);
    console.log(`Post-Savings balance in DB: ${postSavings?.balance}`);
    dbPost.close();
    
    console.log('\nVerification finished.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
