import { useAuth } from "@/hooks/useAuth";
import { LoginDialog } from "./LoginDialog";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import ChangePassword from "./ChangePassword";


export default function Header() {
    const { isAuthenticated, user, logout, login } = useAuth();
    return (
        <div className="flex gap-2 sm:gap-3 flex-shrink-0 items-center justify-end">
            {isAuthenticated ? (
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-100">
                        <div className="flex items-center justify-center w-10 h-10">
                            <img src={user?.avatar} alt={user?.username} className="w-full h-full object-cover rounded-full" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Xin chào</span>
                            <span className="text-sm font-medium text-gray-900">{user?.username}</span>
                        </div>
                    </div>
                    <ChangePassword />
                    <Button
                        variant="outline"
                        onClick={logout}
                        className="whitespace-nowrap"
                        size="sm"
                    >
                        <LogOut className="size-4 mr-2" />
                        <span className="hidden sm:inline">Đăng xuất</span>
                    </Button>
                </div>
            ) : (
                <>
                    <LoginDialog onLoginSuccess={login} />
                </>
            )}
        </div>
    );
}
