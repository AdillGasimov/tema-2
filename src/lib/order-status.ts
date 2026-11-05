export const transitions: Record<string, string[]> = {
  WHATSAPP_PENDING: ["CONFIRMED", "CANCELED"], CONFIRMED: ["PREPARING", "CANCELED"], PREPARING: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED", "CANCELED"], DELIVERED: ["COMPLETED", "RETURNED"], COMPLETED: ["RETURNED"], CANCELED: [], RETURNED: [],
};

const deliveryReadyStatuses = new Set(["CONFIRMED", "PREPARING", "SHIPPED"]);
export const canConfirmDelivery = (status: string) => deliveryReadyStatuses.has(status);
type OrderProgress = { status: string; inventoryState: string; deliveryStatus: string; paidMinor: number; refundedMinor: number; totalMinor: number };
type QuickOrderAction = { label: string; input: { action: "status"; status: "CONFIRMED" | "COMPLETED" } | { action: "deliver" } };
export function quickOrderAction(order: OrderProgress): QuickOrderAction | null {
  if (order.status === "WHATSAPP_PENDING") return { label: "Təsdiqlə", input: { action: "status", status: "CONFIRMED" } };
  if (canConfirmDelivery(order.status) && order.inventoryState === "DEDUCTED") return { label: "Çatdırıldı", input: { action: "deliver" } };
  if (order.status === "DELIVERED" && order.deliveryStatus === "DELIVERED" && order.inventoryState === "DEDUCTED" && order.paidMinor - order.refundedMinor >= order.totalMinor) return { label: "Tamamla", input: { action: "status", status: "COMPLETED" } };
  return null;
}
