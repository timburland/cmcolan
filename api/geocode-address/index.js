const https = require('https');

module.exports = async function (context, req) {
    context.log('Geocode address function triggered');

    // Enable CORS
    context.res = {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    };

    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        const { address } = req.body;

        if (!address) {
            context.res.status = 400;
            context.res.body = { error: 'Missing address' };
            return;
        }

        // Geocode using Nominatim
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&state=Maryland&limit=1`;
        
        const result = await new Promise((resolve, reject) => {
            https.get(url, {
                headers: {
                    'User-Agent': 'CMConlanWebsite/1.0 (Azure Functions)'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });

        if (result && result.length > 0) {
            context.res.status = 200;
            context.res.body = {
                success: true,
                lat: parseFloat(result[0].lat),
                lon: parseFloat(result[0].lon),
                display_name: result[0].display_name
            };
        } else {
            context.res.status = 404;
            context.res.body = {
                success: false,
                error: 'Address not found'
            };
        }

    } catch (error) {
        context.log.error('Geocoding error:', error);
        context.res.status = 500;
        context.res.body = {
            success: false,
            error: 'Geocoding failed',
            details: error.message
        };
    }
};
