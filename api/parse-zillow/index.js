const https = require('https');
const http = require('http');

module.exports = async function (context, req) {
    context.log('Parse Zillow listing triggered');

    // Enable CORS
    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    context.res = {
        headers: corsHeaders
    };

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        context.res.body = {};
        return;
    }

    try {
        const { url } = req.body;

        if (!url) {
            context.res.status = 400;
            context.res.body = { error: 'Missing Zillow URL' };
            return;
        }

        // Validate URL is from Zillow
        if (!url.includes('zillow.com') && !url.includes('trulia.com') && !url.includes('redfin.com')) {
            context.res.status = 400;
            context.res.body = { error: 'URL must be from Zillow, Trulia, or Redfin' };
            return;
        }

        context.log(`Fetching listing from: ${url}`);

        // Fetch the HTML page
        const html = await fetchPage(url);
        
        // Parse the listing data
        const listingData = parseListingHTML(html, url);
        
        context.res.status = 200;
        context.res.body = {
            success: true,
            data: listingData
        };

    } catch (error) {
        context.log.error('Error parsing listing:', error);
        context.res.status = 500;
        context.res.body = { 
            error: 'Failed to parse listing',
            message: error.message 
        };
    }
};

function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        // Enhanced browser-like headers
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0',
                'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'DNT': '1',
                'Referer': 'https://www.google.com/'
            },
            timeout: 15000
        };

        const req = client.request(options, (res) => {
            // Handle redirects
            if (res.statusCode === 301 || res.statusCode === 302) {
                const redirectUrl = res.headers.location;
                if (redirectUrl) {
                    return fetchPage(redirectUrl).then(resolve).catch(reject);
                }
            }

            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: Failed to fetch page. Zillow may be blocking automated requests.`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Network error: ${error.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout. Please try again.'));
        });

        req.end();
    });
}

function parseListingHTML(html, sourceUrl) {
    const data = {
        headline: '',
        street: '',
        city: '',
        state: '',
        zip: '',
        price: '',
        bedrooms: 0,
        bathrooms: 0,
        description: '',
        images: [],
        source: sourceUrl
    };

    try {
        // Extract JSON-LD structured data (most reliable)
        const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
        if (jsonLdMatch) {
            try {
                const jsonData = JSON.parse(jsonLdMatch[1]);
                
                // Handle array of JSON-LD objects
                const listingData = Array.isArray(jsonData) 
                    ? jsonData.find(item => item['@type'] === 'SingleFamilyResidence' || item['@type'] === 'Apartment' || item['@type'] === 'House')
                    : jsonData;
                
                if (listingData) {
                    // Address
                    if (listingData.address) {
                        data.street = listingData.address.streetAddress || '';
                        data.city = listingData.address.addressLocality || '';
                        data.state = listingData.address.addressRegion || '';
                        data.zip = listingData.address.postalCode || '';
                    }
                    
                    // Description
                    data.description = listingData.description || '';
                    
                    // Images
                    if (listingData.image) {
                        if (Array.isArray(listingData.image)) {
                            data.images = listingData.image;
                        } else if (typeof listingData.image === 'string') {
                            data.images = [listingData.image];
                        }
                    }
                    
                    // Bedrooms/bathrooms
                    if (listingData.numberOfRooms) {
                        data.bedrooms = parseInt(listingData.numberOfRooms) || 0;
                    }
                }
            } catch (e) {
                console.error('Error parsing JSON-LD:', e);
            }
        }

        // Fallback: Try to extract from meta tags
        if (!data.street) {
            const addressMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
            if (addressMatch) {
                const fullAddress = addressMatch[1];
                const parts = fullAddress.split(',').map(s => s.trim());
                if (parts.length >= 3) {
                    data.street = parts[0];
                    data.city = parts[1];
                    const stateZip = parts[2].split(' ');
                    data.state = stateZip[0];
                    data.zip = stateZip[1] || '';
                }
            }
        }

        // Extract description from meta tags if not found
        if (!data.description) {
            const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i) ||
                            html.match(/<meta name="description" content="([^"]+)"/i);
            if (descMatch) {
                data.description = descMatch[1];
            }
        }

        // Extract images from various sources if not found
        if (data.images.length === 0) {
            // Try og:image
            const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
            if (ogImageMatch) {
                data.images.push(ogImageMatch[1]);
            }

            // Try to find image URLs in script tags (common pattern)
            const imageUrlMatches = html.match(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi);
            if (imageUrlMatches) {
                // Filter to likely property images (usually larger, contain 'uncropped' or specific patterns)
                const propertyImages = imageUrlMatches.filter(url => 
                    url.includes('photos.zillowstatic.com') || 
                    url.includes('ssl.cdn-redfin.com') ||
                    url.includes('ap.rdcpix.com') ||
                    (url.includes('uncropped') || url.includes('1024') || url.includes('2048'))
                );
                
                // Remove duplicates
                const uniqueImages = [...new Set(propertyImages)];
                data.images = uniqueImages.slice(0, 20); // Limit to 20 images
            }
        }

        // Extract price
        const priceMatch = html.match(/\$[\d,]+/);
        if (priceMatch) {
            data.price = priceMatch[0];
        }

        // Extract beds/baths from text patterns
        const bedsMatch = html.match(/(\d+)\s*(?:bed|bd|bedroom)/i);
        if (bedsMatch) {
            data.bedrooms = parseInt(bedsMatch[1]);
        }

        const bathsMatch = html.match(/([\d.]+)\s*(?:bath|ba|bathroom)/i);
        if (bathsMatch) {
            data.bathrooms = parseFloat(bathsMatch[1]);
        }

        // Generate headline from address
        data.headline = `${data.street}, ${data.city}, ${data.state} ${data.zip}`.trim();

        // Clean up description (remove HTML entities, extra whitespace)
        data.description = data.description
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();

        return data;

    } catch (error) {
        console.error('Error parsing HTML:', error);
        return data; // Return partial data even if parsing fails
    }
}
