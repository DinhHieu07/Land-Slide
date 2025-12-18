"use client";

import dynamic from 'next/dynamic';
import { SidebarInset } from "@/components/ui/sidebar";

// Dynamic import với ssr
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Đang tải bản đồ...</p>
            </div>
        </div>
    ),
});

export default function MapPage() {
    return (
        <SidebarInset className="p-0">
            <div className="w-full h-screen">
                <MapComponent />
            </div>
        </SidebarInset>
    );
}