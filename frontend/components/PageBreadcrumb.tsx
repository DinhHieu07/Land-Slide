"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
    Breadcrumb,
    BreadcrumbEllipsis,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function toTitle(segment: string) {
    if (!segment) return "";

    // Một số mapping đặc biệt cho tiếng Việt
    const map: Record<string, string> = {
        dashboard: "Tổng quan",
        devices: "Quản lý thiết bị",
        history: "Lịch sử",
        account: "Quản lý tài khoản",
    };

    if (map[segment]) return map[segment];

    return segment
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PageBreadcrumb() {
    const pathname = usePathname();
    const router = useRouter();

    const segments = pathname
        .split("/")
        .filter(Boolean); // bỏ phần rỗng

    const items = segments.map((seg, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        return { label: toTitle(seg), href, isLast };
    });

    if (!segments.length) {
        return null;
    }

    return (
        <div className="mb-4 flex flex-col gap-2 md:flex-col md:justify-between">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <Link
                            href="/"
                            className="transition-colors hover:text-foreground"
                        >
                            Trang chủ
                        </Link>
                    </BreadcrumbItem>

                    {items.length > 2 ? (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbEllipsis />
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                {items[items.length - 1].isLast ? (
                                    <BreadcrumbPage>
                                        {items[items.length - 1].label}
                                    </BreadcrumbPage>
                                ) : (
                                    <Link
                                        href={items[items.length - 1].href}
                                        className="transition-colors hover:text-foreground"
                                    >
                                        {items[items.length - 1].label}
                                    </Link>
                                )}
                            </BreadcrumbItem>
                        </>
                    ) : (
                        items.map((item) => (
                            <span key={item.href} className="flex items-center">
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    {item.isLast ? (
                                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                                    ) : (
                                        <Link
                                            href={item.href}
                                            className="transition-colors hover:text-foreground"
                                        >
                                            {item.label}
                                        </Link>
                                    )}
                                </BreadcrumbItem>
                            </span>
                        ))
                    )}
                </BreadcrumbList>
            </Breadcrumb>

            <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex w-fit items-center text-sm text-primary hover:underline cursor-pointer"
            >
                ← Quay lại trang trước
            </button>
        </div>
    );
}