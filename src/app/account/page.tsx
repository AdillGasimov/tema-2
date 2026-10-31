import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
export default async function Account() { const s = await session(); redirect(!s ? "/login" : s.user.role === "ADMIN" ? "/admin" : "/partner"); }
