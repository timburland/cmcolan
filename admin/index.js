const https = require('https');

module.exports = async function (context, req) {
    context.log('Geocode address function triggered');

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

        context.log(`Attempting to geocode: ${address}`);

        // Try multiple strategies in order of specificity
        const strategies = [
            // Strategy 1: Full address with Maryland filter
            {
                url: `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&limit=1`,
                description: 'Full address with US filter'
            },
            // Strategy 2: Remove extra commas and spaces
            {
                url: `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address.replace(/,\s+/g, ', '))}&countrycodes=us&limit=1`,
                description: 'Normalized address'
            },
            // Strategy 3: Add Maryland explicitly to query
            {
                url: `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Maryland')}&countrycodes=us&limit=1`,
                description: 'With Maryland appended'
            },
            // Strategy 4: Try without any filters (most permissive)
            {
                url: `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
                description: 'No filters'
            }
        ];

        let result = null;
        let usedStrategy = null;

        for (const strategy of strategies) {
            context.log(`Trying: ${strategy.description}`);
            
            try {
                const data = await new Promise((resolve, reject) => {
                    https.get(strategy.url, {
                        headers: {
                            'User-Agent': 'CMConlanWebsite/1.0 (Azure Functions)'
                        }
                    }, (res) => {
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

                if (data && data.length > 0) {
                    // Verify it's in Maryland/Montgomery County area
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    
                    // Montgomery County, MD rough bounds
                    // Latitude: 38.9 to 39.3
                    // Longitude: -77.5 to -76.9
                    const inMontgomeryArea = (
                        lat >= 38.8 && lat <= 39.4 &&
                        lon >= -77.6 && lon <= -76.8
                    );

                    if (inMontgomeryArea || data[0].display_name.toLowerCase().includes('maryland')) {
                        result = data[0];
                        usedStrategy = strategy.description;
                        context.log(`✓ Success with: ${strategy.description}`);
                        break;
                    } else {
                        context.log(`Location found but outside Maryland: ${data[0].display_name}`);
                    }
                }
            } catch (strategyError) {
                context.log(`Strategy failed: ${strategyError.message}`);
            }

            // Small delay between attempts
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (result) {
            context.res.status = 200;
            context.res.body = {
                success: true,
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
                display_name: result.display_name,
                strategy: usedStrategy
            };
        } else {
            context.log(`All strategies failed for: ${address}`);
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
