import { Province } from "./province";

export interface Account {
    id: number;
    username: string;
    role: "user" | "admin" | "superAdmin";
    avatar: string;
    created_at: string;
    updated_at?: string;
    province_request_status?: "pending" | "approved";
    provinces?: Province[];
}