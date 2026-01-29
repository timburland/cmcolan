// ALTERNATIVE VERSION: Using Mapbox Geocoding API
// Mapbox gives you 100,000 FREE geocoding requests per month
// Much easier to set up than Azure Maps

const https = require('https');

module.exports = async function (context, req) {
    context.log('Mapbox geocode function triggered');

    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    context.res = { headers: corsHeaders };

    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        context.res.body = {};
        return;
    }

    try {
        const { address } = req.body;

        if (!address) {
            context.res.status = 400;
            context.res.body = { error: 'Missing address' };
            return;
        }

        context.log(`Geocoding with Mapbox: ${address}`);

        // Get Mapbox access token from environment variable
        const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

        if (!mapboxToken) {
            context.log.error('MAPBOX_ACCESS_TOKEN not configured');
            context.res.status = 500;
            context.res.body = { 
                success: false,
                error: 'Mapbox not configured',
                message: 'Please add MAPBOX_ACCESS_TOKEN to your Azure Function App settings'
            };
            return;
        }

        // Mapbox Geocoding API
        const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&country=US&limit=1`;

        const data = await new Promise((resolve, reject) => {
            https.get(mapboxUrl, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        resolve(parsed);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });

        if (data && data.features && data.features.length > 0) {
            const result = data.features[0];
            const [lon, lat] = result.center; // Note: Mapbox returns [lon, lat]
            
            // Check if it's in Maryland
            const context_data = result.context || [];
            const isMaryland = context_data.some(item => 
                item.id.startsWith('region') && 
                (item.text === 'Maryland' || item.short_code === 'US-MD')
            );

            if (isMaryland) {
                context.log(`✓ Mapbox found: ${result.place_name}`);
                context.res.status = 200;
                context.res.body = {
                    success: true,
                    lat: lat,
                    lon: lon,
                    display_name: result.place_name,
                    strategy: 'Mapbox',
                    relevance: result.relevance
                };
            } else {
                context.log(`Location found but not in Maryland: ${result.place_name}`);
                context.res.status = 404;
                context.res.body = {
                    success: false,
                    error: 'Address not found in Maryland'
                };
            }
        } else {
            context.log(`Mapbox found no results for: ${address}`);
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

/* 
SETUP INSTRUCTIONS:

1. Create a Mapbox account (FREE): https://account.mapbox.com/auth/signup/
2. Get your access token from: https://account.mapbox.com/access-tokens/
3. In Azure Portal, go to your Function App
4. Configuration > Application settings > + New application setting
5. Add:
   - Name: MAPBOX_ACCESS_TOKEN
   - Value: (your Mapbox token, starts with "pk.")
6. Save

FREE TIER:
- 100,000 geocoding requests per month
- No credit card required
- Perfect for your use case!
*/
