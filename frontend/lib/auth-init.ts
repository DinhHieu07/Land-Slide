// lib/auth-init.ts
import { getAccessToken, refreshAccessToken } from './auth';

let isRefreshing = false;

export const initAuth = async (): Promise<boolean> => {
    // Tránh gọi nhiều lần
    if (isRefreshing) return false;
    
    const accessToken = getAccessToken();
    
    // Nếu có accessToken rồi thì không cần refresh
    if (accessToken) {
        return true;
    }
    
    // Nếu không có accessToken, thử refresh
    console.log('🔄 No accessToken found, attempting refresh...');
    isRefreshing = true;
    
    try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        
        if (newToken) {
            console.log('✅ Token refreshed successfully');
            return true;
        } else {
            console.log('❌ Refresh failed');
            return false;
        }
    } catch (error) {
        console.error('❌ Error during auth init:', error);
        isRefreshing = false;
        return false;
    }
};