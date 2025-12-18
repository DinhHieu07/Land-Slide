import DashboardView from "@/components/DashBoard";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";

export default function DashboardPage() {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-4">
            <PageBreadcrumb />
            <DashboardView />
        </div>
    );
}