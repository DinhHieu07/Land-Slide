const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Lấy access token từ localStorage
export const getAccessToken = (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("accessToken");
};

// Lưu access token vào localStorage
export const setAccessToken = (token: string | null) => {
    if (typeof window === "undefined") return;
    if (token) {
        localStorage.setItem("accessToken", token);
    } else {
        localStorage.removeItem("accessToken");
    }
};

// Xóa tokens trên client
export const clearTokens = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
};

// Refresh access token
export const refreshAccessToken = async (): Promise<string | null> => {
    try {
        const response = await fetch(`${API_URL}/api/auth/refresh-token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include", // gửi cookie kèm request
        });

        const data = await response.json();

        if (response.ok && data.data?.accessToken) {
            // Lưu access token mới
            setAccessToken(data.data.accessToken);
            return data.data.accessToken;
        } else {
            // Refresh token không hợp lệ, xóa tất cả
            clearTokens();
            return null;
        }
    } catch (error) {
        console.error("Error refreshing token:", error);
        clearTokens();
        return null;
    }
};

// Fetch với tự động refresh token
export const authenticatedFetch = async (
    url: string,
    options: RequestInit = {}
): Promise<Response> => {
    const accessToken = getAccessToken();

    // Thêm Authorization header
    const headers = {
        ...options.headers,
        "Content-Type": "application/json",
        Authorization: accessToken ? `Bearer ${accessToken}` : "",
    };

    // Thực hiện request với credentials để gửi cookie
    let response = await fetch(url, {
        ...options,
        headers,
        credentials: "include", // gửi cookie kèm request
    });

    const cloned = response.clone();
    const data = await cloned.json();

    // Nếu token hết hạn, thử refresh
    if (response.status === 401 && data?.error === "Token đã hết hạn") {
        const newAccessToken = await refreshAccessToken();

        if (newAccessToken) {
            // Retry với token mới
            headers.Authorization = `Bearer ${newAccessToken}`;
            response = await fetch(url, {
                ...options,
                headers,
                credentials: "include",
            });
        } else {
            // Không thể refresh, redirect về trang đăng nhập
            if (typeof window !== "undefined") {
                window.location.href = "/";
            }
        }
    }

    return response;
};

// Logout
export const logout = async () => {
    try {
        await authenticatedFetch(`${API_URL}/api/auth/logout`, {
            method: "POST",
        });
    } catch (error) {
        console.error("Error logging out:", error);
    }

    clearTokens();
    
    if (typeof window !== "undefined") {
        window.location.href = "/";
    }
};

