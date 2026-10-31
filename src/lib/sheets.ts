import { JWT } from "google-auth-library";
import { db, transaction } from "./db";
import { expireReservations } from "./commerce";
export type SheetWriter = (range: string, values: (string | number)[][]) => Promise<void>;
function googleWriter(): SheetWriter {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON, sheetId = process.env.GOOGLE_SHEET_ID;
  if (!raw || !sheetId || !/^[\w-]+$/.test(sheetId)) throw new Error("GOOGLE_SHEETS_NOT_CONFIGURED");
  const credentials = JSON.parse(raw);
  const client = new JWT({ email: credentials.client_email, key: credentials.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return async (range, values) => { await client.request({ url: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, method: "PUT", data: { values }, timeout: 15000 }); };
}
export async function syncSheets(writer?: SheetWriter) {
  await transaction(expireReservations);
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const settings = await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  if (!settings.sheetsEnabled) return { disabled: true, processed: 0 };
  const acquired = await transaction(async tx => {
    const state = await tx.integrationState.upsert({ where: { id: "sheets" }, create: { id: "sheets", lockedUntil: new Date(0) }, update: {} });
    if (state.lockedUntil > new Date()) return false;
    await tx.integrationState.update({ where: { id: "sheets" }, data: { lockedUntil: new Date(Date.now() + 180000) } }); return true;
  });
  if (!acquired) return { locked: true, processed: 0 };
  let processed = 0;
  try {
    let write: SheetWriter;
    try { write = writer ?? googleWriter(); }
    catch { await db.integrationSyncJob.updateMany({ where: { status: { not: "DONE" } }, data: { lastError: "Google Sheets credentials or sheet ID are not configured.", nextRunAt: new Date(Date.now() + 60000) } }); return { configured: false, processed }; }
    const jobs = await db.integrationSyncJob.findMany({ where: { status: { not: "DONE" }, nextRunAt: { lte: new Date() } }, take: 5, orderBy: { updatedAt: "asc" } });
    for (const job of jobs) {
      try {
        const row = job.sheetRow ?? await transaction(async tx => {
          const current = await tx.integrationSyncJob.findUniqueOrThrow({ where: { id: job.id } }); if (current.sheetRow) return current.sheetRow;
          const state = await tx.integrationState.update({ where: { id: "sheets" }, data: { nextRow: { increment: 1 } } });
          await tx.integrationSyncJob.update({ where: { id: job.id }, data: { sheetRow: state.nextRow - 1 } }); return state.nextRow - 1;
        });
        const o = await db.order.findUniqueOrThrow({ where: { id: job.orderId }, include: { items: true, partner: true, commission: true } });
        await write("Orders!A1:K1", [["Order", "Created UTC", "Customer", "Phone", "Products", "AZN", "Referral", "Partner", "Status", "Commission", "Updated UTC"]]);
        await write(`Orders!A${row}:K${row}`, [[o.reference, o.createdAt.toISOString(), o.customerName, o.phone, o.items.map(i => `${i.productName} × ${i.quantity}`).join("; "), (o.totalMinor / 100).toFixed(2), o.referralCode ?? "", o.partner?.name ?? "", o.status, o.commission?.status ?? "NOT_ELIGIBLE", o.updatedAt.toISOString()]]);
        // An order changed while HTTP was in flight: do not mark the newer version synced.
        await db.integrationSyncJob.updateMany({ where: { id: job.id, version: job.version }, data: { status: "DONE", attempts: { increment: 1 }, lastError: null } }); processed++;
      } catch {
        await db.integrationSyncJob.updateMany({ where: { id: job.id, version: job.version }, data: { status: "RETRY", attempts: { increment: 1 }, lastError: "Google Sheets sync failed; check service account permissions and network access.", nextRunAt: new Date(Date.now() + Math.min(3600000, 1000 * 2 ** Math.min(job.attempts + 1, 12))) } });
      }
    }
    return { processed };
  } finally { await db.integrationState.update({ where: { id: "sheets" }, data: { lockedUntil: new Date(0) } }); }
}
