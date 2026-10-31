import { requireUser } from "@/lib/auth";
import { analytics } from "@/lib/analytics";
import { Overview } from "@/components/dashboard-overview";
export default async function Admin() { await requireUser("ADMIN"); return <Overview data={await analytics()} />; }
