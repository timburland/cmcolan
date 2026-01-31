/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FILE PATH: api/upload-image/index.js
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Upload images to Azure Blob Storage
 * Based on your existing file with security added
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const { validateApiKey, checkRateLimit, getClientIp, getCorsHeaders } = require('../shared/security');

module.exports = async function (context, req) {
    context.log('Upload image function triggered');

    // Enable CORS
    context.res = {
        headers: getCorsHeaders()
    };

    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    // === SECURITY: Validate API Key ===
    const authResult = validateApiKey(req, context);
    if (!authResult.valid) {
        context.log.warn(`Unauthorized upload attempt from ${getClientIp(req)}`);
        context.res.status = 401;
        context.res.body = { error: `Unauthorized: ${authResult.error}` };
        return;
    }

    // === SECURITY: Rate Limiting (20 requests/minute) ===
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 20, 60000);
    if (!rateLimit.allowed) {
        context.log.warn(`Rate limit exceeded for ${clientIp}`);
        context.res.status = 429;
        context.res.headers['Retry-After'] = rateLimit.retryAfter;
        context.res.body = { error: 'Too many requests. Please try again later.' };
        return;
    }

    try {
        const { imageData, fileName, address } = req.body;

        if (!imageData || !fileName) {
            context.res.status = 400;
            context.res.body = { error: 'Missing imageData or fileName' };
            return;
        }

        // === SECURITY: Validate image type ===
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        const mimeMatch = imageData.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        
        if (!mimeMatch) {
            context.res.status = 400;
            context.res.body = { error: 'Invalid image format' };
            return;
        }
        
        const mimeType = mimeMatch[1].toLowerCase();
        if (!validTypes.includes(mimeType)) {
            context.res.status = 400;
            context.res.body = { error: `Invalid image type: ${mimeType}` };
            return;
        }

        // === SECURITY: Check file size (10MB max) ===
        const base64Data = imageData.split(',')[1];
        const sizeInBytes = (base64Data.length * 3) / 4;
        if (sizeInBytes > 10 * 1024 * 1024) {
            context.res.status = 400;
            context.res.body = { error: 'Image too large. Maximum size is 10MB.' };
            return;
        }

        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        
        if (!connectionString) {
            context.res.status = 500;
            context.res.body = { error: 'Storage not configured' };
            return;
        }

        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Create folder path from address if provided
        let folderPath = '';
        if (address && address.street && address.city && address.state && address.zip) {
            // Sanitize address components for folder name
            const sanitize = (str) => str.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
            folderPath = `${sanitize(address.street)}_${sanitize(address.city)}_${sanitize(address.state)}_${sanitize(address.zip)}/`;
        }

        // Generate unique filename
        const uniqueFileName = `${folderPath}${Date.now()}_${fileName}`;

        // Upload to blob storage
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerName = 'property-images';
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        // Create container if it doesn't exist (with public access)
        await containerClient.createIfNotExists({ access: 'blob' });

        // Upload the file
        const blockBlobClient = containerClient.getBlockBlobClient(uniqueFileName);
        const contentType = imageData.split(';')[0].split(':')[1]; // Extract mime type
        
        await blockBlobClient.upload(buffer, buffer.length, {
            blobHTTPHeaders: { blobContentType: contentType }
        });

        // Return the URL
        const imageUrl = blockBlobClient.url;

        context.log('Image uploaded successfully:', imageUrl);
        context.res.status = 200;
        context.res.body = { 
            success: true,
            url: imageUrl 
        };

    } catch (error) {
        context.log.error('Error uploading image:', error);
        context.res.status = 500;
        context.res.body = { 
            error: 'Failed to upload image',
            details: error.message 
        };
    }
};
