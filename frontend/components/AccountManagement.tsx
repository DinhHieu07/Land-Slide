"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Trash, Pencil, Filter, KeyRound, Shield, MoreHorizontal, ArrowLeft, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Account } from "@/types/account";
import { Province } from "@/types/province";
import { Toast, ToastSeverity } from "@/components/Toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const roleColor: Record<Account["role"], string> = {
    admin: "bg-blue-100 text-blue-800",
    superAdmin: "bg-purple-100 text-purple-800",
};

const roleLabel: Record<Account["role"], string> = {
    admin: "Admin",
    superAdmin: "SuperAdmin",
};

export default function AccountManagement() {
    const { isAuthenticated, isSuperAdmin, loading, user } = useAuth();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [openResetPasswordDialog, setOpenResetPasswordDialog] = useState(false);
    const [openChangeRoleDialog, setOpenChangeRoleDialog] = useState(false);
    const [openManageProvincesDialog, setOpenManageProvincesDialog] = useState(false);
    const [editing, setEditing] = useState<Account | null>(null);
    const [allProvinces, setAllProvinces] = useState<Province[]>([]);
    const [selectedProvinceIds, setSelectedProvinceIds] = useState<number[]>([]);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [form, setForm] = useState({
        username: "",
        password: "",
        role: "admin" as Account["role"],
    });
    const [resetPasswordForm, setResetPasswordForm] = useState({
        newPassword: "",
        confirmPassword: "",
    });
    const [changeRoleForm, setChangeRoleForm] = useState({
        role: "admin" as Account["role"],
    });
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastSeverity, setToastSeverity] = useState<ToastSeverity>("success");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmAccountId, setConfirmAccountId] = useState<number | null>(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [totalAccounts, setTotalAccounts] = useState(0);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [accountsError, setAccountsError] = useState<string | null>(null);

    const fetchAccounts = async () => {
        const params = new URLSearchParams();
        if (debouncedSearch) params.append("search", debouncedSearch);
        if (roleFilter && roleFilter !== "all") params.append("role", roleFilter);
        params.append("limit", String(pageSize));
        params.append("offset", String((page - 1) * pageSize));

        setLoadingAccounts(true);
        setAccountsError(null);

        try {
            const res = await authenticatedFetch(`${API_URL}/api/accounts?${params.toString()}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setAccounts(data.data || []);
                setTotalAccounts(data.pagination?.total ?? data.data?.length ?? 0);
            } else {
                console.warn("Lỗi khi lấy danh sách tài khoản", data);
                setAccounts([]);
                setTotalAccounts(0);
                setAccountsError(data?.message || "Không thể tải dữ liệu tài khoản.");
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách tài khoản", error);
            setAccounts([]);
            setTotalAccounts(0);
            setAccountsError("Không thể tải dữ liệu tài khoản.");
        } finally {
            setLoadingAccounts(false);
        }
    };

    // Debounce search đợi 500ms sau khi ngừng nhập
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [search]);

    useEffect(() => {
        if (isAuthenticated && isSuperAdmin) {
            fetchAccounts();
            fetchAllProvinces();
        }
    }, [isAuthenticated, isSuperAdmin, debouncedSearch, page, roleFilter]);

    const fetchAllProvinces = async () => {
        try {
            const res = await authenticatedFetch(`${API_URL}/api/provinces/list-provinces/${user?.username || ''}`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setAllProvinces(data.data || []);
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách tỉnh thành", error);
        }
    };

    const fetchAccountProvinces = async (accountId: number) => {
        if (!editing || editing.role === 'superAdmin') {
            // SuperAdmin không cần fetch
            setLoadingProvinces(false);
            return;
        }

        setLoadingProvinces(true);
        try {
            const res = await authenticatedFetch(`${API_URL}/api/accounts/${accountId}/provinces`, {
                method: "GET",
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setSelectedProvinceIds(data.data?.map((p: Province) => p.id) || []);
            } else {
                setToastMessage(data?.message || "Không thể tải danh sách tỉnh thành");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách tỉnh thành", error);
            setToastMessage("Lỗi kết nối máy chủ");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setLoadingProvinces(false);
        }
    };

    const handleManageProvinces = (account: Account) => {
        setEditing(account);
        setOpenManageProvincesDialog(true);
        fetchAccountProvinces(account.id);
    };

    const handleUpdateProvinces = async () => {
        if (!editing) return;

        // SuperAdmin không cần cập nhật
        if (editing.role === 'superAdmin') {
            setToastMessage("SuperAdmin quản lý tất cả tỉnh thành");
            setToastSeverity("info");
            setToastOpen(true);
            setOpenManageProvincesDialog(false);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await authenticatedFetch(`${API_URL}/api/accounts/${editing.id}/provinces`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    provinceIds: selectedProvinceIds,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setToastMessage("Cập nhật tỉnh thành thành công");
                setToastSeverity("success");
                setToastOpen(true);
                setOpenManageProvincesDialog(false);
                fetchAccounts();
            } else {
                setToastMessage(data?.message || "Cập nhật tỉnh thành thất bại");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (err) {
            console.error(err);
            setToastMessage("Lỗi kết nối máy chủ");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!form.username || (!editing && !form.password)) {
            setToastMessage("Vui lòng điền đầy đủ thông tin");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }

        if (!editing && form.password.length < 6) {
            setToastMessage("Mật khẩu phải có ít nhất 6 ký tự");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }

        setIsSubmitting(true);
        try {
            type CreateAccountPayload = {
                username: string;
                role: Account["role"];
                password?: string;
            };

            const payload: CreateAccountPayload = {
                username: form.username,
                role: form.role,
            };

            if (!editing) {
                payload.password = form.password;
            }

            const url = editing
                ? `${API_URL}/api/accounts/${editing.id}`
                : `${API_URL}/api/accounts`;
            const method = editing ? "PUT" : "POST";

            const res = await authenticatedFetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setOpenDialog(false);
                setEditing(null);
                setForm({
                    username: "",
                    password: "",
                    role: "admin",
                });
                setToastMessage(editing ? "Cập nhật tài khoản thành công" : "Tạo tài khoản thành công");
                setToastSeverity("success");
                setToastOpen(true);
                fetchAccounts();
            } else {
                setToastMessage(data?.message || "Lỗi lưu tài khoản");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (err) {
            console.error(err);
            setToastMessage("Lỗi kết nối máy chủ");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (account: Account) => {
        setEditing(account);
        setForm({
            username: account.username,
            password: "",
            role: account.role,
        });
        setOpenDialog(true);
    };

    const handleDelete = async (accountId: number) => {
        const res = await authenticatedFetch(`${API_URL}/api/accounts/${accountId}`, {
            method: "DELETE",
        });
        const data = await res.json();
        if (res.ok && data.success) {
            setAccounts(accounts.filter((a) => a.id !== accountId));
            setToastMessage("Xóa tài khoản thành công");
            setToastSeverity("success");
            setToastOpen(true);
            setConfirmOpen(false);
            setConfirmAccountId(null);
            fetchAccounts();
        } else {
            setToastMessage(data?.message || "Xóa thất bại");
            setToastSeverity("error");
            setToastOpen(true);
            setConfirmOpen(false);
            setConfirmAccountId(null);
        }
    };

    const handleResetPassword = async () => {
        if (!resetPasswordForm.newPassword || resetPasswordForm.newPassword.length < 6) {
            setToastMessage("Mật khẩu mới phải có ít nhất 6 ký tự");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }

        if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
            setToastMessage("Mật khẩu xác nhận không khớp");
            setToastSeverity("error");
            setToastOpen(true);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await authenticatedFetch(
                `${API_URL}/api/accounts/${editing?.id}/reset-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        newPassword: resetPasswordForm.newPassword,
                    }),
                }
            );
            const data = await res.json();
            if (res.ok && data.success) {
                setOpenResetPasswordDialog(false);
                setResetPasswordForm({
                    newPassword: "",
                    confirmPassword: "",
                });
                setToastMessage("Đặt lại mật khẩu thành công");
                setToastSeverity("success");
                setToastOpen(true);
            } else {
                setToastMessage(data?.message || "Đặt lại mật khẩu thất bại");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (err) {
            console.error(err);
            setToastMessage("Lỗi kết nối máy chủ");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChangeRole = async () => {
        setIsSubmitting(true);
        try {
            const res = await authenticatedFetch(
                `${API_URL}/api/accounts/${editing?.id}/change-role`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        role: changeRoleForm.role,
                    }),
                }
            );
            const data = await res.json();
            if (res.ok && data.success) {
                setOpenChangeRoleDialog(false);
                setChangeRoleForm({
                    role: "admin",
                });
                setToastMessage("Thay đổi role thành công");
                setToastSeverity("success");
                setToastOpen(true);
                fetchAccounts();
            } else {
                setToastMessage(data?.message || "Thay đổi role thất bại");
                setToastSeverity("error");
                setToastOpen(true);
            }
        } catch (err) {
            console.error(err);
            setToastMessage("Lỗi kết nối máy chủ");
            setToastSeverity("error");
            setToastOpen(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil((totalAccounts || 0) / pageSize));
    const paginated = accounts;

    useEffect(() => {
        setPage(1);
    }, [search, roleFilter]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-64" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                </div>

                <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-end gap-3">
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="w-full md:w-40 space-y-1.5">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-10 w-20" />
                    </div>
                </div>

                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <th key={i} className="px-4 py-3">
                                            <Skeleton className="h-4 w-24" />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[1, 2, 3, 4, 5].map((row) => (
                                    <tr key={row} className="border-t">
                                        {[1, 2, 3, 4, 5].map((col) => (
                                            <td key={col} className="px-4 py-3">
                                                {col === 1 ? (
                                                    <div className="flex items-center gap-3">
                                                        <Skeleton className="h-10 w-10 rounded-full" />
                                                        <Skeleton className="h-4 w-24" />
                                                    </div>
                                                ) : (
                                                    <Skeleton className="h-4 w-full" />
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-48" />
                    <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-9 w-16" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated || !isSuperAdmin) {
        return (
            <div className="p-6">
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <p className="text-red-600 font-semibold">
                        Bạn cần quyền Super Admin để truy cập trang này.
                    </p>
                </div>
            </div>
        );
    }

    // Không thể tải dữ liệu
    if (!loadingAccounts && accountsError) {
        return (
            <div className="p-6">
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <p className="text-gray-600">Không thể tải dữ liệu tài khoản.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold">Quản lý tài khoản</h1>
                    <p className="text-sm text-muted-foreground">
                        Quản lý người dùng, phân quyền và bảo mật hệ thống.
                    </p>
                </div>
            </div>
            <div className="flex justify-end">
                <Dialog
                    open={openDialog}
                    onOpenChange={(open) => {
                        setOpenDialog(open);
                        if (!open) {
                            setEditing(null);
                            setForm({
                                username: "",
                                password: "",
                                role: "admin",
                            });
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <Button
                            className="self-end"
                            onClick={() => {
                                setEditing(null);
                                setForm({
                                    username: "",
                                    password: "",
                                    role: "admin",
                                });
                            }}
                        >
                            Thêm tài khoản
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editing ? "Chỉnh sửa tài khoản" : "Thêm tài khoản"}
                            </DialogTitle>
                            <DialogDescription>Nhập thông tin tài khoản.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div>
                                <Label>Tên đăng nhập</Label>
                                <Input
                                    value={form.username}
                                    onChange={(e) =>
                                        setForm({ ...form, username: e.target.value })
                                    }
                                    placeholder="Nhập tên đăng nhập"
                                />
                            </div>
                            {!editing && (
                                <div>
                                    <Label>Mật khẩu</Label>
                                    <Input
                                        type="password"
                                        value={form.password}
                                        onChange={(e) =>
                                            setForm({ ...form, password: e.target.value })
                                        }
                                        placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                                    />
                                </div>
                            )}
                            <div>
                                <Label>Vai trò</Label>
                                <Select
                                    value={form.role}
                                    onValueChange={(value: Account["role"]) =>
                                        setForm({ ...form, role: value })
                                    }
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Chọn vai trò" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Quản trị viên</SelectItem>
                                        <SelectItem value="superAdmin">Siêu quản trị</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? "Đang lưu..." : "Lưu"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1">
                        <Label>Tìm kiếm (tên đăng nhập)</Label>
                        <Input
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Nhập tên đăng nhập"
                        />
                    </div>
                    <div className="w-full md:w-40 space-y-1.5">
                        <Label>Vai trò</Label>
                        <Select
                            value={roleFilter}
                            onValueChange={(value) => setRoleFilter(value)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Tất cả" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả</SelectItem>
                                <SelectItem value="admin">Quản trị viên</SelectItem>
                                <SelectItem value="superAdmin">Siêu quản trị</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={fetchAccounts}>
                        <Filter className="size-4 mr-2" />
                        Lọc
                    </Button>
                </div>
            </div>

            <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                                    Người dùng
                                </th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                                    Tên đăng nhập
                                </th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                                    Vai trò
                                </th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                                    Ngày tạo
                                </th>
                                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                                    Hành động
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingAccounts && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                                            <p className="text-gray-600">Đang tải danh sách tài khoản...</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {paginated.map((account) => (
                                <tr key={account.id} className="border-t">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={account.avatar} />
                                                <AvatarFallback>
                                                    {account.username.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium text-gray-900">
                                                {account.username}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{account.username}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={cn(
                                                "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                                                roleColor[account.role]
                                            )}
                                        >
                                            {roleLabel[account.role]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {account.created_at
                                            ? new Date(account.created_at).toLocaleString("vi-VN")
                                            : "N/A"}
                                    </td>
                                    <td className="px-4 py-3 text-left">
                                        {account.id !== user?.id ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                    >
                                                        <MoreHorizontal className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        className="cursor-pointer hover:bg-gray-100"
                                                        onClick={() => {
                                                            setEditing(account);
                                                            setOpenResetPasswordDialog(true);
                                                        }}
                                                    >
                                                        <KeyRound className="mr-2 size-4" />
                                                        <span>Đặt lại mật khẩu</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="cursor-pointer hover:bg-gray-100"
                                                        onClick={() => handleEdit(account)}
                                                    >
                                                        <Pencil className="mr-2 size-4" />
                                                        <span>Sửa</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="cursor-pointer hover:bg-gray-100"
                                                        onClick={() => handleManageProvinces(account)}
                                                    >
                                                        <MapPin className="mr-2 size-4" />
                                                        <span>Quản lý tỉnh thành</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600 focus:text-red-600 cursor-pointer hover:bg-gray-100"
                                                        onClick={() => {
                                                            setConfirmAccountId(account.id);
                                                            setConfirmOpen(true);
                                                        }}
                                                    >
                                                        <Trash className="mr-2 size-4" />
                                                        <span>Xóa</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <span className="text-sm text-gray-500 italic">
                                                Tài khoản của bạn
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    Hiển thị {paginated.length === 0 ? 0 : (page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, totalAccounts)} / {totalAccounts} tài khoản
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                    >
                        Đầu
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Trước
                    </Button>
                    <div className={cn("px-3 py-1 rounded-md border text-sm", "bg-white")}>
                        Trang {page} / {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Tiếp
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                    >
                        Cuối
                    </Button>
                </div>
            </div>

            {/* Dialog xác nhận xóa */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xóa tài khoản</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn xóa tài khoản này không? Hành động này không thể
                            hoàn tác.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)}>Hủy</Button>
                        <Button
                            variant="destructive"
                            onClick={() => handleDelete(confirmAccountId || 0)}
                        >
                            Xóa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog đặt lại mật khẩu */}
            <Dialog
                open={openResetPasswordDialog}
                onOpenChange={(open) => {
                    setOpenResetPasswordDialog(open);
                    if (!open) {
                        setResetPasswordForm({
                            newPassword: "",
                            confirmPassword: "",
                        });
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Đặt lại mật khẩu</DialogTitle>
                        <DialogDescription>
                            Đặt lại mật khẩu cho tài khoản: {editing?.username}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Mật khẩu mới</Label>
                            <Input
                                type="password"
                                value={resetPasswordForm.newPassword}
                                onChange={(e) =>
                                    setResetPasswordForm({
                                        ...resetPasswordForm,
                                        newPassword: e.target.value,
                                    })
                                }
                                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                            />
                        </div>
                        <div>
                            <Label>Xác nhận mật khẩu</Label>
                            <Input
                                type="password"
                                value={resetPasswordForm.confirmPassword}
                                onChange={(e) =>
                                    setResetPasswordForm({
                                        ...resetPasswordForm,
                                        confirmPassword: e.target.value,
                                    })
                                }
                                placeholder="Nhập lại mật khẩu mới"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenResetPasswordDialog(false)}>Hủy</Button>
                        <Button onClick={handleResetPassword} disabled={isSubmitting}>
                            {isSubmitting ? "Đang xử lý..." : "Đặt lại"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog thay đổi role */}
            <Dialog
                open={openChangeRoleDialog}
                onOpenChange={(open) => {
                    setOpenChangeRoleDialog(open);
                    if (!open) {
                        setChangeRoleForm({
                            role: "admin",
                        });
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Thay đổi vai trò</DialogTitle>
                        <DialogDescription>
                            Thay đổi vai trò cho tài khoản: {editing?.username}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Vai trò</Label>
                            <Select
                                value={changeRoleForm.role}
                                onValueChange={(value: Account["role"]) =>
                                    setChangeRoleForm({ role: value })
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Chọn vai trò" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Quản trị viên</SelectItem>
                                    <SelectItem value="superAdmin">Siêu quản trị</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenChangeRoleDialog(false)}>Hủy</Button>
                        <Button onClick={handleChangeRole} disabled={isSubmitting}>
                            {isSubmitting ? "Đang xử lý..." : "Thay đổi"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog quản lý tỉnh thành */}
            <Dialog
                open={openManageProvincesDialog}
                onOpenChange={(open) => {
                    setOpenManageProvincesDialog(open);
                    if (!open) {
                        setSelectedProvinceIds([]);
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Quản lý tỉnh thành</DialogTitle>
                        <DialogDescription>
                            {editing?.role === 'superAdmin' 
                                ? `Tài khoản ${editing?.username} là SuperAdmin và quản lý tất cả tỉnh thành.`
                                : `Chọn các tỉnh thành mà tài khoản ${editing?.username} được quản lý.`}
                        </DialogDescription>
                    </DialogHeader>
                    {editing?.role === 'superAdmin' ? (
                        <div className="py-4">
                            <div className="rounded-lg border bg-blue-50 p-4">
                                <p className="text-sm text-blue-800">
                                    SuperAdmin có quyền quản lý tất cả tỉnh thành trong hệ thống. 
                                    Không cần cấu hình thêm.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {loadingProvinces ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <Label className="text-base font-semibold">
                                            Danh sách tỉnh thành ({selectedProvinceIds.length}/{allProvinces.length})
                                        </Label>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    if (selectedProvinceIds.length === allProvinces.length) {
                                                        setSelectedProvinceIds([]);
                                                    } else {
                                                        setSelectedProvinceIds(allProvinces.map(p => p.id));
                                                    }
                                                }}
                                            >
                                                {selectedProvinceIds.length === allProvinces.length 
                                                    ? "Bỏ chọn tất cả" 
                                                    : "Chọn tất cả"}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto space-y-2 border rounded-lg p-4">
                                        {allProvinces.length === 0 ? (
                                            <p className="text-sm text-gray-500 text-center py-4">
                                                Không có tỉnh thành nào
                                            </p>
                                        ) : (
                                            allProvinces.map((province) => (
                                                <div
                                                    key={province.id}
                                                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 transition-colors "
                                                >
                                                    <Checkbox
                                                        checked={selectedProvinceIds.includes(province.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedProvinceIds(prev => [...prev, province.id]);
                                                            } else {
                                                                setSelectedProvinceIds(prev => prev.filter(id => id !== province.id));
                                                            }
                                                        }}
                                                    />
                                                    <Label>{province.name}</Label>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => setOpenManageProvincesDialog(false)}
                        >
                            {editing?.role === 'superAdmin' ? 'Đóng' : 'Hủy'}
                        </Button>
                        {editing?.role !== 'superAdmin' && (
                            <Button 
                                onClick={handleUpdateProvinces} 
                                disabled={isSubmitting || loadingProvinces}
                            >
                                {isSubmitting ? "Đang lưu..." : "Lưu"}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Toast
                open={toastOpen}
                message={toastMessage}
                severity={toastSeverity}
                onClose={() => setToastOpen(false)}
            />
        </div>
    );
}

