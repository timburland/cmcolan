/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FILE PATH: api/get-homes/index.js
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Get homes from Azure Blob Storage
 * Based on your existing file with rate limiting added
 * NOTE: No API key required for reads (public data)
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const { checkRateLimit, getClientIp, getCorsHeaders } = require('../shared/security');

module.exports = async function (context, req) {
    context.log('Get homes function triggered');

    // Enable CORS
    context.res = {
        headers: getCorsHeaders()
    };

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    // === SECURITY: Rate Limiting (60 requests/minute for reads) ===
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 60, 60000);
    if (!rateLimit.allowed) {
        context.log.warn(`Rate limit exceeded for ${clientIp}`);
        context.res.status = 429;
        context.res.headers['Retry-After'] = rateLimit.retryAfter;
        context.res.body = { error: 'Too many requests', items: [] };
        return;
    }

    try {
        // Get connection string from environment variable
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        
        if (!connectionString) {
            context.log.error('AZURE_STORAGE_CONNECTION_STRING not configured');
            context.res.status = 500;
            context.res.body = { error: 'Storage not configured', items: [] };
            return;
        }

        // Create blob service client
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerName = 'homes';
        const blobName = 'homes.json';

        // Get container and blob client
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        // Check if blob exists
        const exists = await blockBlobClient.exists();
        if (!exists) {
            context.log('No homes data found');
            context.res.status = 200;
            context.res.body = { items: [] };
            return;
        }

        // Download the blob
        const downloadResponse = await blockBlobClient.download(0);
        const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
        const data = JSON.parse(downloaded.toString());

        context.log('Homes data retrieved successfully');
        context.res.status = 200;
        context.res.body = data;

    } catch (error) {
        context.log.error('Error retrieving homes:', error);
        context.res.status = 500;
        context.res.body = { 
            error: 'Failed to retrieve homes',
            items: [],
            details: error.message 
        };
    }
};

// Helper function to convert stream to buffer
async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on('error', reject);
    });
}
