import DeviceManager from "@/components/DeviceManager";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import Header from "@/components/Header";

export default function DevicesPage() {
    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <PageBreadcrumb />
                <Header />
            </div>
            <DeviceManager />
        </div>
    );
}