import { Province } from "./province";

export interface Account {
    id: number;
    username: string;
    role: "admin" | "superAdmin";
    avatar: string;
    created_at: string;
    updated_at?: string;
    provinces?: Province[];
}