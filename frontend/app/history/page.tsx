import HistoryView from "@/components/HistoryView";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";

export default function HistoryPage() {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-4">
            <PageBreadcrumb />
            <HistoryView />
        </div>
    );
}
