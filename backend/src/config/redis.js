const redis = require('redis');
const path = require('path');

require('dotenv').config({ 
    path: path.resolve(__dirname, '../../.env')
});

const REDIS_PREFIX = 'Landslide';

const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

const client = redis.createClient({
    url: redisUrl,
    password: process.env.REDIS_PASSWORD || undefined,
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('Redis: Quá nhiều lần thử kết nối lại');
                return new Error('Quá nhiều lần thử kết nối lại');
            }
            return Math.min(retries * 100, 3000);
        }
    }
});

client.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

client.on('connect', () => {
    console.log('Redis: Đã kết nối');
});

client.on('reconnecting', () => {
    console.log('Redis: Đang kết nối lại...');
});

// Kết nối Redis
(async () => {
    try {
        await client.connect();
        console.log('Redis: Kết nối thành công');
    } catch (err) {
        console.error('Redis Connection Error:', err);
    }
})();

// Helper functions
const redisClient = {
    async setRefreshToken(userId, token) {
        const key = `${REDIS_PREFIX}:refresh_token:${userId}`;
        const ttl = 7 * 24 * 60 * 60; // 7 ngày 
        await client.setEx(key, ttl, token);
    },

    async getRefreshToken(userId) {
        const key = `${REDIS_PREFIX}:refresh_token:${userId}`;
        return await client.get(key);
    },

    async deleteRefreshToken(userId) {
        const key = `${REDIS_PREFIX}:refresh_token:${userId}`;
        await client.del(key);
    },
};

module.exports = redisClient;