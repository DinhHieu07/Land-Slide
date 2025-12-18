import DeviceManager from "@/components/DeviceManager";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";

export default function DevicesPage() {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-4">
            <PageBreadcrumb />
            <DeviceManager />
        </div>
    );
}