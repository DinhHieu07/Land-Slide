import AccountManagement from "@/components/AccountManagement";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";

export default function AccountPage() {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-4">
            <PageBreadcrumb />
            <AccountManagement />
        </div>
    );
}