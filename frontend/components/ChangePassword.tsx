"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/Toast";
import { authenticatedFetch } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ChangePassword() {
    const [open, setOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setToastMessage("Mật khẩu xác nhận không khớp");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }

        if (newPassword.length < 6) {
            setToastMessage("Mật khẩu mới phải có ít nhất 6 ký tự");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }

        setLoading(true);

        try {
            const res = await authenticatedFetch(`${API_URL}/api/auth/change-password`, {
                method: "POST",
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();

            if (res.ok) {
                setToastMessage("Đổi mật khẩu thành công");
                setToastSeverity("success");
                setToastOpen(true);
                setOpen(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                setToastMessage(data.error || "Đổi mật khẩu thất bại");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (error) {
            console.error("Error changing password:", error);
            setToastMessage("Có lỗi xảy ra khi đổi mật khẩu");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="whitespace-nowrap">
                        Đổi mật khẩu
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Đổi mật khẩu</DialogTitle>
                        <DialogDescription>
                            Nhập mật khẩu hiện tại và mật khẩu mới để cập nhật tài khoản của bạn.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    placeholder="Nhập mật khẩu hiện tại"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    placeholder="Nhập mật khẩu mới"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    placeholder="Nhập lại mật khẩu mới"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Đang cập nhật..." : "Lưu mật khẩu mới"}
                            </Button>
                        </DialogFooter>
                    </form>
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


