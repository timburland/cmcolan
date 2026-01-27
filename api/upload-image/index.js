const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
    context.log('Upload image function triggered');

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
        const { imageData, fileName } = req.body;

        if (!imageData || !fileName) {
            context.res.status = 400;
            context.res.body = { error: 'Missing imageData or fileName' };
            return;
        }

        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        
        if (!connectionString) {
            context.res.status = 500;
            context.res.body = { error: 'Storage not configured' };
            return;
        }

        // Convert base64 to buffer
        const base64Data = imageData.split(',')[1]; // Remove data:image/...;base64, prefix
        const buffer = Buffer.from(base64Data, 'base64');

        // Generate unique filename
        const uniqueFileName = `${Date.now()}_${fileName}`;

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
