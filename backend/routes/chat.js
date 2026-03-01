const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');

// Polyfill fetch for Node.js (required by Hugging Face SDK)
global.fetch = require('node-fetch');

// Helper to get AI settings
async function getAISettings() {
    try {
        const [rows] = await db.query('SELECT * FROM system_settings WHERE `key` IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['ai_mode', 'ai_provider', 'ai_gemini_key', 'ai_openai_key', 'ai_huggingface_key', 'ai_huggingface_model', 'ai_gemini_model', 'ai_openai_model', 'ai_deepseek_key', 'ai_deepseek_model', 'ai_anthropic_key', 'ai_anthropic_model']);

        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });

        const provider = settings.ai_provider || 'gemini';
        let apiKey = '';
        if (provider === 'openai') apiKey = settings.ai_openai_key;
        else if (provider === 'huggingface') apiKey = settings.ai_huggingface_key;
        else if (provider === 'deepseek') apiKey = settings.ai_deepseek_key;
        else if (provider === 'anthropic') apiKey = settings.ai_anthropic_key;
        else apiKey = settings.ai_gemini_key;

        return {
            mode: settings.ai_mode || 'manual',
            provider: provider,
            apiKey: apiKey || '',
            geminiModel: settings.ai_gemini_model || 'gemini-2.0-flash',
            openaiModel: settings.ai_openai_model || 'gpt-4o-mini',
            deepseekModel: settings.ai_deepseek_model || 'deepseek-chat',
            anthropicModel: settings.ai_anthropic_model || 'claude-4-5-sonnet-latest',
            huggingfaceModel: settings.ai_huggingface_model || 'meta-llama/Llama-3.2-3B-Instruct'
        };
    } catch (err) {
        console.error('Error fetching AI settings:', err);
        return { mode: 'manual', provider: 'gemini', apiKey: '' };
    }
}

// Manual mode: Smart rule-based responses using database data & translation support
function getManualResponse(message, context) {
    const lowerMsg = (message || "").toLowerCase();
    const safeContext = context || "";

    // Detect Language (Simple check for Khmer characters)
    const isKhmer = /[\u1780-\u17FF]/.test(message);

    const t = (en, kh) => isKhmer ? kh : en;

    // Parse context data
    let employees = [];
    let attendance = [];
    let leaves = [];
    try {
        const empMatch = safeContext.match(/Employees: (\[.*?\])/s);
        const attMatch = safeContext.match(/Attendance Records: (\[.*?\])/s);
        const leaveMatch = safeContext.match(/Leave Requests: (\[.*?\])/s);

        if (empMatch && empMatch[1]) employees = JSON.parse(empMatch[1]);
        if (attMatch && attMatch[1]) attendance = JSON.parse(attMatch[1]);
        if (leaveMatch && leaveMatch[1]) leaves = JSON.parse(leaveMatch[1]);
    } catch (e) {
        console.error('Failed to parse context', e);
    }

    // 1. Check for "Late / យឺត"
    if (lowerMsg.includes('late') || lowerMsg.includes('យឺត')) {
        const today = new Date().toISOString().split('T')[0];
        const lateToday = attendance.filter(a => {
            const isLate = a.status === 'យឺត' || a.status === 'Late';
            const isToday = a.date && a.date.includes(today);
            return isLate && isToday;
        });

        if (lateToday.length > 0) {
            const names = lateToday.map(a => a.employeeName || 'Unknown').join(', ');
            return t(
                `Today, ${lateToday.length} employee(s) are late: ${names}.`,
                `ថ្ងៃនេះមានបុគ្គលិកចំនួន ${lateToday.length} នាក់យឺត៖ ${names}។`
            );
        }
        return t('No one is late today.', 'មិនមានអ្នកមកយឺតទេថ្ងៃនេះ។');
    }

    // 2. Check for "Total / សរុប"
    if (lowerMsg.includes('total') || lowerMsg.includes('សរុប') || lowerMsg.includes('បុគ្គលិក')) {
        const active = employees.filter(e => e.status === 'សកម្ម' || e.status === 'Active').length;
        return t(
            `Total employees is ${employees.length} (${active} active).`,
            `មានបុគ្គលិកសរុបចំនួន ${employees.length} នាក់ (សកម្ម ${active} នាក់)។`
        );
    }

    // 3. Check for specific employee by name
    const foundEmp = employees.find(e => e.name && lowerMsg.includes(e.name.toLowerCase()));
    if (foundEmp) {
        return t(
            `${foundEmp.name} works in ${foundEmp.dep} as ${foundEmp.pos}. Status: ${foundEmp.status}.`,
            `${foundEmp.name} ធ្វើការនៅផ្នែក ${foundEmp.dep} តំណែងជា ${foundEmp.pos}។ ស្ថានភាព៖ ${foundEmp.status}។`
        );
    }

    // 4. Check for "Leave / សម្រាក / ច្បាប់"
    if (lowerMsg.includes('leave') || lowerMsg.includes('ច្បាប់') || lowerMsg.includes('សម្រាក')) {
        const pending = leaves.filter(l => l.status === 'រង់ចាំ' || l.status === 'Pending').length;
        const approvedToday = leaves.filter(l => (l.status === 'អនុម័ត' || l.status === 'Approved')).length;

        return t(
            `There are ${pending} pending leave requests and ${approvedToday} total approved leaves.`,
            `មានសំណើរសុំច្បាប់រង់ចាំចំនួន ${pending} និងច្បាប់ដែលបានអនុម័តសរុបចំនួន ${approvedToday}។`
        );
    }

    // 5. Check for "Salary / ប្រាក់ខែ / ចំណាយ"
    if (lowerMsg.includes('salary') || lowerMsg.includes('ប្រាក់ខែ') || lowerMsg.includes('spend')) {
        const totalSalary = employees.reduce((sum, e) => sum + (parseFloat(e.sal) || 0), 0);
        return t(
            `The total monthly salary expenditure is $${totalSalary.toLocaleString()}.`,
            `ការចំណាយប្រាក់បៀវត្សរ៍សរុបប្រចាំខែគឺ $${totalSalary.toLocaleString()}។`
        );
    }

    // 6. Check for "Audit / Log / សកម្មភាព"
    if (lowerMsg.includes('audit') || lowerMsg.includes('log') || lowerMsg.includes('សកម្មភាព')) {
        return t(
            'You can view all system activities in the Audit Logs section of the Sidebar. It tracks who created employees, updated payroll, or changed settings.',
            'អ្នកអាចមើលសកម្មភាពប្រព័ន្ធទាំងអស់នៅក្នុងផ្នែក "កំណត់ត្រាសកម្មភាព (Audit Logs)" នៅក្នុង Sidebar។ វាបង្ហាញពីអ្នកដែលបានបង្កើតបុគ្គលិក ធ្វើបច្ចុប្បន្នភាពប្រាក់ខែ ឬផ្លាស់ប្តូរការកំណត់។'
        );
    }

    // Fallback response
    return t(
        `I am your HR Personal Assistant. You can ask me about:
        - Daily attendance (Who is late?)
        - Employee info (Tell me about [Name])
        - Statistics (Total staff, Salary spend)
        - Leave requests (How many leaves?)
        - System activities (Show me audit logs)`,
        `ខ្ញុំជាជំនួយការ HR របស់អ្នក។ អ្នកអាចសួរខ្ញុំអំពី៖
        - វត្តមានប្រចាំថ្ងៃ (តើអ្នកណាខ្លះមកយឺត?)
        - ព័ត៌មានបុគ្គលិក (ប្រាប់ខ្ញុំអំពី [ឈ្មោះ])
        - ស្ថិតិសរុប (ចំនួនបុគ្គលិក, ការចំណាយប្រាក់ខែ)
        - សំណើរសុំច្បាប់ (តើមានច្បាប់ប៉ុន្មាន?)
        - សកម្មភាពប្រព័ន្ធ (បង្ហាញកំណត់ត្រាសកម្មភាព)`
    );
}

// API mode: Call Gemini, OpenAI, or Hugging Face
async function getAPIResponse(message, context, provider, apiKey, geminiModel, openaiModel, huggingfaceModel, deepseekModel, anthropicModel) {
    try {
        if (provider === 'gemini') {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
                {
                    contents: [{
                        parts: [{ text: `You are an HR Expert AI for D2D ONE HR. Context: ${context}\n\nUser Message: ${message}` }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error('Gemini returned an empty response. Please check your API key or try again.');
            }
            return text;

        } else if (provider === 'openai') {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: openaiModel,
                    messages: [
                        { role: 'system', content: 'You are an HR Expert AI for D2D ONE HR.' },
                        { role: 'user', content: `Context: ${context}\n\nQuestion: ${message}` }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('OpenAI returned an empty response. Please check your API key or try again.');
            }
            return content;

        } else if (provider === 'huggingface') {
            const response = await axios.post(
                `https://api-inference.huggingface.co/models/${huggingfaceModel}`,
                {
                    inputs: `Context: ${context}\n\nQuestion: ${message}\n\nAnswer:`,
                    options: { wait_for_model: true }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            let text = '';
            if (Array.isArray(response.data)) {
                text = response.data[0]?.generated_text || response.data[0]?.text;
            } else if (response.data.generated_text) {
                text = response.data.generated_text;
            } else if (typeof response.data === 'string') {
                text = response.data;
            }

            if (!text) {
                if (response.data.error?.includes('loading')) {
                    throw new Error('Model is currently loading. Please wait 20-30 seconds and try again.');
                }
                throw new Error('Hugging Face returned an empty response. Please try again.');
            }
            return text;

        } else if (provider === 'deepseek') {
            const response = await axios.post(
                'https://api.deepseek.com/v1/chat/completions',
                {
                    model: deepseekModel || 'deepseek-chat',
                    messages: [
                        { role: 'system', content: 'You are an HR Expert AI for D2D ONE HR.' },
                        { role: 'user', content: `Context: ${context}\n\nQuestion: ${message}` }
                    ],
                    max_tokens: 1024,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('DeepSeek returned an empty response. Please check your API key.');
            }
            return content;

        } else if (provider === 'anthropic') {
            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: anthropicModel || 'claude-3-5-sonnet-latest',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: `Context: ${context}\n\nQuestion: ${message}\n\nPlease act as an HR Expert for D2D ONE HR.` }
                    ],
                    system: "You are an HR Expert AI for D2D ONE HR."
                },
                {
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.content?.[0]?.text;
            if (!content) {
                throw new Error('Anthropic returned an empty response. Please check your API key.');
            }
            return content;
        }

        throw new Error('Unknown AI provider selected');

    } catch (error) {
        // Enhanced error handling
        let errorMsg = 'Unknown error occurred';

        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            if (status === 401) {
                errorMsg = 'Invalid API key. Please check your API key and try again.';
            } else if (status === 403) {
                errorMsg = 'Access forbidden. Your API key may not have the required permissions.';
            } else if (status === 404) {
                errorMsg = 'API endpoint not found. The model or service may have changed or the model name is invalid.';
            } else if (status === 410) {
                errorMsg = 'API endpoint deprecated. Please contact support to update the integration.';
            } else if (status === 429) {
                const retryAfter = error.response.headers?.['retry-after'];
                errorMsg = `Rate limit exceeded. ${retryAfter ? `Please wait ${retryAfter}s before retrying.` : 'Please wait a moment and try again.'} Your API quota might be limited.`;
            } else if (status === 500 || status === 503) {
                errorMsg = 'AI service is temporarily unavailable. Please try again in a few moments.';
            } else {
                errorMsg = data?.error?.message || data?.error || error.message || `Request failed with status ${status}`;
            }
        } else if (error.request) {
            errorMsg = 'No response from AI service. Please check your internet connection.';
        } else {
            errorMsg = error.message || 'Failed to connect to AI service';
        }

        console.error(`AI API Error (${provider}):`, errorMsg);
        throw new Error(errorMsg);
    }
}

// Get dynamic suggestions based on role and language
router.get('/suggestions', async (req, res) => {
    try {
        let { role, lang } = req.query;

        // Alias role for suggestions (Accountant uses Admin suggestions)
        let queryRole = role || 'employee';
        if (queryRole === 'accountant') queryRole = 'admin';

        // Final fallback: Ensure role exists in our suggestion set
        const validRoles = ['super_admin', 'admin', 'employee'];
        if (!validRoles.includes(queryRole)) queryRole = 'employee';

        let query = 'SELECT text FROM chat_suggestions WHERE role = ? AND language = ? ORDER BY RAND() LIMIT 6';
        const [rows] = await db.query(query, [queryRole, lang || 'en']);
        console.log(`📡 Sugget Fetch: Role=${queryRole}, Lang=${lang}, Found=${rows.length}`);
        res.json({ suggestions: rows.map(r => r.text) });
    } catch (err) {
        console.error("Error fetching suggestions:", err);
        res.status(500).json({ error: 'Failed to fetch suggestions' });
    }
});

// Add a new suggestion to the database
router.post('/suggestions/add', async (req, res) => {
    try {
        const { role, lang, text } = req.body;
        if (!text) return res.status(400).json({ error: 'Suggestion text is required' });

        await db.query('INSERT INTO chat_suggestions (role, language, text) VALUES (?, ?, ?)',
            [role || 'employee', lang || 'en', text]);

        res.json({ success: true, message: 'Suggestion added' });
    } catch (err) {
        console.error("Error adding suggestion:", err);
        res.status(500).json({ error: 'Failed to add suggestion' });
    }
});

router.post('/message', async (req, res) => {
    try {
        const { message, context, testMode, testKey, testProvider, testModel } = req.body;

        let settings;
        if (testMode) {
            settings = {
                mode: 'api',
                provider: testProvider || 'gemini',
                apiKey: testKey,
                geminiModel: testProvider === 'gemini' ? testModel : 'gemini-2.0-flash',
                openaiModel: testProvider === 'openai' ? testModel : 'gpt-4o-mini',
                deepseekModel: testProvider === 'deepseek' ? testModel : 'deepseek-chat',
                anthropicModel: testProvider === 'anthropic' ? testModel : 'claude-4-5-sonnet-latest',
                huggingfaceModel: testProvider === 'huggingface' ? testModel : 'meta-llama/Llama-3.2-3B-Instruct'
            };
        } else {
            settings = await getAISettings();
        }

        let responseText;

        if (settings.mode === 'manual') {
            responseText = getManualResponse(message, context);
        } else {
            if (!settings.apiKey) {
                return res.status(400).json({ error: 'AI API Key is not configured. Please contact Super Admin.' });
            }
            responseText = await getAPIResponse(message, context, settings.provider, settings.apiKey, settings.geminiModel, settings.openaiModel, settings.huggingfaceModel, settings.deepseekModel, settings.anthropicModel);
        }

        res.json({ response: responseText });

    } catch (err) {
        console.error("AI Chat Route Error:", err.message);
        res.status(500).json({ error: err.message || 'Failed to get AI response' });
    }
});

module.exports = router;
