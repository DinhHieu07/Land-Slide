"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Toast, ToastSeverity } from "@/components/Toast";
import { CheckCircle2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type PendingProvinceRequest = {
    id: number;
    user_id: number;
    username: string;
    province_name: string;
    created_at: string;
};

export default function ProvinceRequestManagement() {
    const { isAuthenticated, isAdmin, loading } = useAuth();
    const [requests, setRequests] = useState<PendingProvinceRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [submittingUserId, setSubmittingUserId] = useState<number | null>(null);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastSeverity, setToastSeverity] = useState<ToastSeverity>("success");

    const fetchRequests = async () => {
        setLoadingRequests(true);
        try {
            const res = await authenticatedFetch(`${API_URL}/api/accounts/province-requests/pending`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setRequests(data.data || []);
            } else {
                setRequests([]);
            }
        } catch (error) {
            console.error(error);
            setRequests([]);
        } finally {
            setLoadingRequests(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchRequests();
        }
    }, [isAuthenticated, isAdmin]);

    const approveRequest = async (userId: number) => {
        setSubmittingUserId(userId);
        try {
            const res = await authenticatedFetch(`${API_URL}/api/accounts/${userId}/province-requests/approve`, {
                method: "POST",
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setToastMessage("Duyệt tỉnh thành thành công");
                setToastSeverity("success");
                setToastOpen(true);
                fetchRequests();
            } else {
                setToastMessage(data?.message || "Duyệt yêu cầu thất bại");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (error) {
            console.error(error);
            setToastMessage("Lỗi kết nối máy chủ");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setSubmittingUserId(null);
        }
    };

    if (loading) {
        return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
    }

    if (!isAuthenticated || !isAdmin) {
        return (
            <div className="p-6">
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <p className="text-red-600 font-semibold">
                        Bạn cần quyền Admin để truy cập trang này.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Duyệt tỉnh thành user</h1>
                    <p className="text-sm text-muted-foreground">
                        Duyệt yêu cầu chọn tỉnh thành đang sinh sống từ tài khoản user.
                    </p>
                </div>
            </div>

            <div className="rounded-lg border bg-white p-4 shadow-sm">
                {loadingRequests ? (
                    <p className="text-sm text-muted-foreground">Đang tải yêu cầu...</p>
                ) : requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Hiện không có yêu cầu chờ duyệt.</p>
                ) : (
                    <div className="space-y-2">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                            >
                                <div className="text-sm">
                                    <p className="font-medium text-gray-900">{request.username}</p>
                                    <p className="text-gray-600">
                                        Đã chọn: <span className="font-medium">{request.province_name}</span>
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Gửi lúc {new Date(request.created_at).toLocaleString("vi-VN")}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => approveRequest(request.user_id)}
                                    disabled={submittingUserId === request.user_id}
                                >
                                    <CheckCircle2 className="size-4 mr-2" />
                                    {submittingUserId === request.user_id ? "Đang duyệt..." : "Duyệt"}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Toast
                open={toastOpen}
                message={toastMessage}
                severity={toastSeverity}
                onClose={() => setToastOpen(false)}
            />
        </div>
    );
}

