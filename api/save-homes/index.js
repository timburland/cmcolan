const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
    context.log('Save homes function triggered');

    // Enable CORS
    context.res = {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    };

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
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
