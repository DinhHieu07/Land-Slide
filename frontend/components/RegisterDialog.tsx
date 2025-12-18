"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
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
import { Toast } from "./Toast";

interface RegisterDialogProps {
    onRegisterSuccess?: () => void;
}

export function RegisterDialog({ onRegisterSuccess }: RegisterDialogProps) {
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setToastMessage("Mật khẩu xác nhận không khớp");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }

        if (password.length < 6) {
            setToastMessage("Mật khẩu phải có ít nhất 6 ký tự");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                setToastMessage("Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.");
                setToastSeverity("success");
                setToastOpen(true);
                setOpen(false);
                setUsername("");
                setPassword("");
                setConfirmPassword("");
            } else {
                setToastMessage(data.error || "Đăng ký thất bại");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (error) {
            console.error("Error:", error);
            setToastMessage("Có lỗi xảy ra khi đăng ký");
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
                    <Button className="whitespace-nowrap cursor-pointer">
                        <UserPlus className="size-4 mr-2" />
                        <span className="hidden sm:inline">Đăng ký</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Đăng ký tài khoản</DialogTitle>
                        <DialogDescription>
                            Tạo tài khoản mới để sử dụng hệ thống.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="reg-username">Tên đăng nhập</Label>
                                <Input
                                    id="reg-username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nhập tên đăng nhập"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="reg-password">Mật khẩu</Label>
                                <Input
                                    id="reg-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Tối thiểu 6 ký tự"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="reg-confirm-password">Xác nhận mật khẩu</Label>
                                <Input
                                    id="reg-confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Nhập lại mật khẩu"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Đang đăng ký..." : "Đăng ký"}
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

