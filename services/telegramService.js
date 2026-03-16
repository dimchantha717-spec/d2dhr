const TelegramBot = require('node-telegram-bot-api');
const db = require('../config/db');
require('dotenv').config();

const sendNotification = async (message) => {
    try {
        // 1. Try to get settings from Database
        const [rows] = await db.query('SELECT value FROM system_settings WHERE `key` = "attendance_settings"');
        
        let token = process.env.TELEGRAM_BOT_TOKEN;
        let chatId = process.env.TELEGRAM_CHAT_ID;
        let enabled = true;

        if (rows.length > 0) {
            try {
                const settings = JSON.parse(rows[0].value);
                if (settings.telegram) {
                    token = settings.telegram.botToken || token;
                    chatId = settings.telegram.chatId || chatId;
                    enabled = settings.telegram.enabled !== undefined ? settings.telegram.enabled : enabled;
                }
            } catch (e) {
                console.error('Failed to parse telegram settings from DB:', e.message);
            }
        }

        if (!enabled || !token || !chatId) {
            console.warn('Telegram notification skipped: Not configured or disabled.');
            return;
        }

        const bot = new TelegramBot(token, { polling: false });
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log('Telegram notification sent successfully.');
    } catch (error) {
        console.error('Error sending Telegram notification:', error.message);
    }
};

module.exports = { sendNotification };
