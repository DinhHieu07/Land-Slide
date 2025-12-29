"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoginDialog } from "./LoginDialog";
import { Button } from "./ui/button";
import { LogOut, KeyRound } from "lucide-react";
import ChangePassword from "./ChangePassword";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default function Header() {
    const { isAuthenticated, user, logout, login } = useAuth();
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);

    return (
        <div className="flex gap-2 sm:gap-3 flex-shrink-0 items-center justify-end">
            {isAuthenticated ? (
                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-100 bg-white hover:bg-blue-50 transition cursor-pointer"
                            >
                                <div className="flex items-center justify-center w-10 h-10">
                                    <img
                                        src={user?.avatar}
                                        alt={user?.username}
                                        className="w-full h-full object-cover rounded-full"
                                    />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-xs text-gray-500">Xin chào</span>
                                    <span className="text-sm font-medium text-gray-900">
                                        {user?.username}
                                    </span>
                                </div>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => setChangePasswordOpen(true)}
                            >
                                <KeyRound className="mr-2 size-4" />
                                <span>Đổi mật khẩu</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer text-red-600 focus:text-red-600"
                                onClick={logout}
                            >
                                <LogOut className="mr-2 size-4" />
                                <span>Đăng xuất</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <ChangePassword
                        open={changePasswordOpen}
                        onOpenChange={setChangePasswordOpen}
                    />
                </div>
            ) : (
                <>
                    <LoginDialog onLoginSuccess={login} />
                </>
            )}
        </div>
    );
}
