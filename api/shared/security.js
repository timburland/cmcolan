/**
 * FILE PATH: api/shared/security.js
 * 
 * NEW FILE - Create this folder and file
 * Shared Security Utilities for C.M. Conlan API
 */

// In-memory rate limiting (resets on function cold start)
const rateLimitStore = new Map();

/**
 * Validate API Secret Key
 * Checks the X-API-Key header against API_SECRET_KEY environment variable
 */
function validateApiKey(req, context) {
    const apiSecret = process.env.API_SECRET_KEY;
    
    if (!apiSecret) {
        context.log.warn('WARNING: API_SECRET_KEY not configured - API is unprotected!');
        return { valid: true, warning: 'No API key configured' };
    }
    
    const providedKey = req.headers['x-api-key'];
    
    if (!providedKey) {
        return { valid: false, error: 'Missing API key' };
    }
    
    if (providedKey !== apiSecret) {
        return { valid: false, error: 'Invalid API key' };
    }
    
    return { valid: true };
}

/**
 * Rate Limiting - prevents abuse
 */
function checkRateLimit(ip, limit = 30, windowMs = 60000) {
    const now = Date.now();
    const key = ip || 'unknown';
    
    let record = rateLimitStore.get(key);
    
    if (!record || (now - record.windowStart) > windowMs) {
        record = { count: 1, windowStart: now };
        rateLimitStore.set(key, record);
        return { allowed: true, remaining: limit - 1 };
    }
    
    record.count++;
    rateLimitStore.set(key, record);
    
    if (record.count > limit) {
        return { 
            allowed: false, 
            remaining: 0,
            retryAfter: Math.ceil((record.windowStart + windowMs - now) / 1000)
        };
    }
    
    return { allowed: true, remaining: limit - record.count };
}

/**
 * Get client IP from request headers
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
        || req.headers['x-client-ip']
        || 'unknown';
}

/**
 * Sanitize string input to prevent XSS
 */
function sanitizeString(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim();
}

/**
 * CORS headers helper - updated to allow X-API-Key header
 */
function getCorsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
    };
}

module.exports = {
    validateApiKey,
    checkRateLimit,
    getClientIp,
    sanitizeString,
    getCorsHeaders
};
