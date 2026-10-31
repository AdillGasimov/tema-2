import { publicSettings } from "@/lib/settings";
import { endpoint } from "@/lib/http";
export async function GET() { return endpoint(publicSettings); }
