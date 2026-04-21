"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/auth";
import { Province } from "@/types/province";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Toast } from "./Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface LivingProvinceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    username?: string;
    authenticated?: boolean;
    title?: string;
    description?: string;
}

export default function LivingProvinceDialog({
    open,
    onOpenChange,
    username,
    authenticated = false,
    title = "Chọn tỉnh thành đang sinh sống",
    description = "Thông tin này dùng để gửi cảnh báo theo khu vực. Bạn có thể cập nhật lại sau.",
}: LivingProvinceDialogProps) {
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [selectedProvinceId, setSelectedProvinceId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastSeverity, setToastSeverity] = useState<"success" | "error" | "info">("success");

    useEffect(() => {
        if (!open) return;
        const loadProvinces = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/provinces/public`);
                const data = await res.json();
                if (res.ok && data?.success) {
                    setProvinces(data.data || []);
                } else {
                    setToastMessage("Không thể tải danh sách tỉnh thành");
                    setToastSeverity("error");
                    setToastOpen(true);
                }
            } catch (error) {
                console.error("Lỗi tải tỉnh thành:", error);
                setToastMessage("Lỗi kết nối máy chủ");
                setToastSeverity("error");
                setToastOpen(true);
            } finally {
                setLoading(false);
            }
        };

        const loadCurrentSelection = async () => {
            if (!authenticated) return;
            try {
                const res = await authenticatedFetch(`${API_URL}/api/auth/my-province-request`, {
                    method: "GET",
                });
                const data = await res.json();
                const provinceId =
                    data?.data?.latestRequest?.province_id || data?.data?.approvedProvince?.province_id;
                if (provinceId) {
                    setSelectedProvinceId(String(provinceId));
                }
            } catch (error) {
                console.error("Lỗi tải tỉnh thành hiện tại:", error);
            }
        };

        loadProvinces();
        loadCurrentSelection();
    }, [open, authenticated]);

    const submitProvince = async () => {
        if (!selectedProvinceId) {
            setToastMessage("Vui lòng chọn tỉnh thành");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }

        setSaving(true);
        try {
            let res: Response;
            if (authenticated) {
                res = await authenticatedFetch(`${API_URL}/api/auth/my-province-request`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ provinceId: Number(selectedProvinceId) }),
                });
            } else {
                res = await fetch(`${API_URL}/api/auth/province-request-by-username`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username,
                        provinceId: Number(selectedProvinceId),
                    }),
                });
            }

            const data = await res.json();
            if (res.ok && data?.success) {
                setToastMessage(data.message || "Đã gửi yêu cầu, vui lòng chờ admin duyệt.");
                setToastSeverity("success");
                setToastOpen(true);
                onOpenChange(false);
            } else {
                setToastMessage(data?.message || "Không thể lưu lựa chọn tỉnh thành");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (error) {
            console.error("Lỗi gửi yêu cầu tỉnh thành:", error);
            setToastMessage("Lỗi kết nối máy chủ");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Tỉnh/Thành phố</Label>
                        <Select
                            value={selectedProvinceId}
                            onValueChange={setSelectedProvinceId}
                            disabled={loading || saving}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={loading ? "Đang tải..." : "Chọn tỉnh thành"} />
                            </SelectTrigger>
                            <SelectContent>
                                {provinces.map((province) => (
                                    <SelectItem key={province.id} value={String(province.id)}>
                                        {province.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                        >
                            Để sau
                        </Button>
                        <Button onClick={submitProvince} disabled={saving || loading}>
                            {saving ? "Đang gửi..." : "Lưu & gửi duyệt"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Toast
                open={toastOpen}
                message={toastMessage}
                severity={toastSeverity}
                onClose={() => setToastOpen(false)}
            />
        </>
    );
}

