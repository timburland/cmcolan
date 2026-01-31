/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FILE PATH: api/save-homes/index.js
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Save homes to Azure Blob Storage
 * Based on your existing file with security added
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const { validateApiKey, checkRateLimit, getClientIp, sanitizeString, getCorsHeaders } = require('../shared/security');

module.exports = async function (context, req) {
    context.log('Save homes function triggered');

    // Enable CORS (updated to allow X-API-Key header)
    context.res = {
        headers: getCorsHeaders()
    };

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    // === SECURITY: Validate API Key ===
    const authResult = validateApiKey(req, context);
    if (!authResult.valid) {
        context.log.warn(`Unauthorized save attempt from ${getClientIp(req)}`);
        context.res.status = 401;
        context.res.body = { error: `Unauthorized: ${authResult.error}` };
        return;
    }

    // === SECURITY: Rate Limiting (10 requests/minute for writes) ===
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 10, 60000);
    if (!rateLimit.allowed) {
        context.log.warn(`Rate limit exceeded for ${clientIp}`);
        context.res.status = 429;
        context.res.headers['Retry-After'] = rateLimit.retryAfter;
        context.res.body = { error: 'Too many requests. Please try again later.' };
        return;
    }

    try {
        const homes = req.body;

        if (!homes || !Array.isArray(homes.items)) {
            context.res.status = 400;
            context.res.body = { error: 'Invalid data format' };
            return;
        }

        // Get connection string from environment variable
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        
        if (!connectionString) {
            context.log.error('AZURE_STORAGE_CONNECTION_STRING not configured');
            context.res.status = 500;
            context.res.body = { error: 'Storage not configured' };
            return;
        }

        // Create blob service client
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerName = 'homes';
        const blobName = 'homes.json';

        // Get container client (create if doesn't exist)
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists({ access: 'blob' });

        // Upload the data
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const data = JSON.stringify(homes, null, 2);
        await blockBlobClient.upload(data, data.length, {
            blobHTTPHeaders: { blobContentType: 'application/json' }
        });

        context.log('Homes data saved successfully');
        context.res.status = 200;
        context.res.body = { 
            success: true, 
            message: 'Homes published successfully!',
            count: homes.items.length 
        };

    } catch (error) {
        context.log.error('Error saving homes:', error);
        context.res.status = 500;
        context.res.body = { 
            error: 'Failed to save homes',
            details: error.message 
        };
    }
};
