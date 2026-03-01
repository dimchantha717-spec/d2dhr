const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Create a bot that uses 'polling' to fetch new updates (if we want to receive)
// or just for sending messages (we don't strictly need polling if just sending)
// setting polling: false for now as we just want to send notifications
const bot = token ? new TelegramBot(token, { polling: false }) : null;

const sendNotification = async (message) => {
    if (!bot || !chatId) {
        console.warn('Telegram bot is not configured properly (missing token or chat ID).');
        return;
    }

    try {
        await bot.sendMessage(chatId, message);
        console.log('Telegram notification sent successfully.');
    } catch (error) {
        console.error('Error sending Telegram notification:', error.message);
    }
};

module.exports = { sendNotification };
