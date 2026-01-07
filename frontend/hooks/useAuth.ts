"use client";

import React, { useState, useEffect, useContext, createContext } from "react";
import { logout as logoutUtil, getAccessToken } from "@/lib/auth";
import { initAuth } from "@/lib/auth-init";

export interface User {
    id: number;
    username: string;
    role: string;
    avatar: string;
}

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    login: (userData: User, accessToken: string) => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initializeAuth = async () => {
            console.log('🔍 Initializing auth...');

            // Kiểm tra và refresh token
            const hasValidToken = await initAuth();
            console.log('✅ Has valid token:', hasValidToken);

            // Kiểm tra localStorage để lấy thông tin user
            const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
            const accessToken = getAccessToken();

            if (storedUser && accessToken) {
                try {
                    const userData = JSON.parse(storedUser);
                    console.log('👤 User data found:', userData);
                    setUser(userData);
                } catch (error) {
                    console.error("❌ Error parsing user data:", error);
                    localStorage.removeItem("user");
                    await logoutUtil();
                }
            } else if (storedUser && !accessToken) {
                // Có user nhưng không có token -> xóa user
                console.log('⚠️ User data exists but no token, cleaning up...');
                localStorage.removeItem("user");
            }

            setLoading(false);
        }
        initializeAuth();
    }, []);

    const login = (userData: User, accessToken: string) => {
        if (typeof window !== "undefined") {
            localStorage.setItem("user", JSON.stringify(userData));
            localStorage.setItem("accessToken", accessToken);
        }
        setUser(userData);
    };

    const logout = async () => {
        await logoutUtil();
        setUser(null);
    };

    const isAuthenticated = !!user;
    const isAdmin = user?.role === "admin" || user?.role === "superAdmin";
    const isSuperAdmin = user?.role === "superAdmin";

    const value: AuthContextValue = {
        user,
        loading,
        isAuthenticated,
        isAdmin,
        isSuperAdmin,
        login,
        logout,
    };

    return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}