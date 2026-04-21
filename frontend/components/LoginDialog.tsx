"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
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
import { setAccessToken } from "@/lib/auth";
import type { User } from "@/hooks/useAuth";

interface LoginDialogProps {
    onLoginSuccess?: (user: User, accessToken: string) => void;
}

export function LoginDialog({ onLoginSuccess }: LoginDialogProps) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<"login" | "forgot">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [resetEmail, setResetEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const resetDialogState = () => {
        setMode("login");
        setUsername("");
        setPassword("");
        setResetEmail("");
        setOtp("");
        setNewPassword("");
        setConfirmNewPassword("");
        setOtpSent(false);
        setLoading(false);
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
                credentials: "include", // Nhận cookie từ server
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("user", JSON.stringify(data.data.user));
                // Lưu accessToken vào bộ nhớ tạm (in-memory)
                if (data.data?.accessToken) {
                    setAccessToken(data.data.accessToken);
                }

                setToastMessage("Đăng nhập thành công!");
                setToastSeverity("success");
                setToastOpen(true);
                setOpen(false);
                resetDialogState();

                // Gọi callback để cập nhật state trong useAuth
                if (onLoginSuccess) {
                    onLoginSuccess(data.data.user, data.data?.accessToken || "");
                }

            } else {
                setToastMessage(data.error || "Đăng nhập thất bại");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (error) {
            console.error("Error:", error);
            setToastMessage("Có lỗi xảy ra khi đăng nhập");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async () => {
        if (!resetEmail.trim()) {
            setToastMessage("Vui lòng nhập email");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/forgot-password/request-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: resetEmail.trim() }),
            });
            const data = await res.json();

            if (res.ok) {
                setOtpSent(true);
                setToastMessage("Đã gửi OTP. Mã có hiệu lực 1 phút.");
                setToastSeverity("success");
            } else {
                setToastMessage(data.error || "Không gửi được OTP");
                setToastSeverity("error");
            }
            setToastOpen(true);
        } catch (error) {
            console.error("Error sending OTP:", error);
            setToastMessage("Có lỗi xảy ra khi gửi OTP");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otpSent) {
            setToastMessage("Vui lòng gửi OTP trước");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setToastMessage("Xác nhận mật khẩu không khớp");
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
            const res = await fetch(`${API_URL}/api/auth/forgot-password/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: resetEmail.trim(),
                    otp: otp.trim(),
                    newPassword,
                }),
            });
            const data = await res.json();

            if (res.ok) {
                setToastMessage("Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.");
                setToastSeverity("success");
                setToastOpen(true);
                setMode("login");
                setPassword("");
                setOtp("");
                setNewPassword("");
                setConfirmNewPassword("");
                setOtpSent(false);
            } else {
                setToastMessage(data.error || "Đặt lại mật khẩu thất bại");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (error) {
            console.error("Error resetting password:", error);
            setToastMessage("Có lỗi xảy ra khi đặt lại mật khẩu");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(value) => {
                    setOpen(value);
                    if (!value) resetDialogState();
                }}
            >
                <DialogTrigger asChild>
                    <Button variant="outline" className="whitespace-nowrap text-foreground cursor-pointer">
                        <LogIn className="size-4 mr-2" />
                        <span className="hidden sm:inline">Đăng nhập</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{mode === "login" ? "Đăng nhập" : "Quên mật khẩu"}</DialogTitle>
                        <DialogDescription>
                            {mode === "login"
                                ? "Nhập thông tin đăng nhập của bạn để tiếp tục."
                                : "Nhập email, nhận OTP và đặt mật khẩu mới."}
                        </DialogDescription>
                    </DialogHeader>
                    {mode === "login" ? (
                    <form onSubmit={handleLoginSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="username">Tên đăng nhập (Email)</Label>
                                <Input
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nhập tên đăng nhập (Email)"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="password">Mật khẩu</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="link"
                                className="mr-auto px-0"
                                onClick={() => setMode("forgot")}
                                disabled={loading}
                            >
                                Quên mật khẩu?
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                            </Button>
                        </DialogFooter>
                    </form>
                    ) : (
                    <form onSubmit={handleResetPassword}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="resetEmail">Tên đăng nhập (Email)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="resetEmail"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        placeholder="Nhập tên đăng nhập (Email)"
                                        required
                                        disabled={loading}
                                    />
                                    <Button type="button" onClick={handleSendOtp} disabled={loading}>
                                        Gửi OTP
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="otp">Mã OTP (6 số)</Label>
                                <Input
                                    id="otp"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="Nhập OTP"
                                    required
                                    disabled={loading || !otpSent}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu mới"
                                    required
                                    disabled={loading || !otpSent}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="confirmNewPassword">Xác nhận mật khẩu mới</Label>
                                <Input
                                    id="confirmNewPassword"
                                    type="password"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    placeholder="Nhập lại mật khẩu mới"
                                    required
                                    disabled={loading || !otpSent}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setMode("login")}
                                disabled={loading}
                            >
                                Quay lại đăng nhập
                            </Button>
                            <Button type="submit" disabled={loading || !otpSent}>
                                {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                            </Button>
                        </DialogFooter>
                    </form>
                    )}
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

