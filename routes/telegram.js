const express = require('express');
const router = express.Router();
const TelegramBot = require('node-telegram-bot-api');

// Since bot token might be dynamic (per user settings) or static (env), we need to handle both.
// If it's stored in settings DB, we should fetch it. If passed from client, we use it (but be careful).
// The frontend 'TelegramSettings.tsx' allows user to input a token.
// So we'll accept it in the body for the 'test' function, but for real notifications we might load from DB.

router.post('/send', async (req, res) => {
    try {
        const { botToken, chatId, message } = req.body;

        if (!botToken || !chatId || !message) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        const bot = new TelegramBot(botToken, { polling: false });

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

        res.json({ success: true, message: 'Sent' });
    } catch (err) {
        console.error("Telegram Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
