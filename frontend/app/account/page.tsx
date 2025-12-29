import AccountManagement from "@/components/AccountManagement";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import Header from "@/components/Header";

export default function AccountPage() {
    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <PageBreadcrumb />
                <Header />
            </div>
            <AccountManagement />
        </div>
    );
}