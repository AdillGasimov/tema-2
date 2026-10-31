import { NextRequest } from "next/server";
import { catalog } from "@/lib/catalog";
import { endpoint } from "@/lib/http";
export async function GET(req: NextRequest) { return endpoint(() => catalog(req.nextUrl.searchParams)); }
