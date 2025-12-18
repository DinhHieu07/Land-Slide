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

interface LoginDialogProps {
    onLoginSuccess?: (user: any, accessToken: string) => void;
}

export function LoginDialog({ onLoginSuccess }: LoginDialogProps) {
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const handleSubmit = async (e: React.FormEvent) => {
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
                setUsername("");
                setPassword("");

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

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="whitespace-nowrap text-foreground cursor-pointer">
                        <LogIn className="size-4 mr-2" />
                        <span className="hidden sm:inline">Đăng nhập</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Đăng nhập</DialogTitle>
                        <DialogDescription>
                            Nhập thông tin đăng nhập của bạn để tiếp tục.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="username">Tên đăng nhập</Label>
                                <Input
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nhập tên đăng nhập"
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
                            <Button type="submit" disabled={loading}>
                                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
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

