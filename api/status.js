export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { taskId, apiKey } = req.query;

    if (!taskId || !apiKey) {
        return res.status(400).json({ error: 'Missing taskId or apiKey' });
    }

    try {
        const response = await fetch(`https://api.freepik.com/v1/ai/tasks/${taskId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
