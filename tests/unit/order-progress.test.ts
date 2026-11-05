import { describe, expect, it } from "vitest";
import { quickOrderAction, transitions } from "../../src/lib/order-status";
const order = { status: "CONFIRMED", inventoryState: "DEDUCTED", deliveryStatus: "PENDING", paidMinor: 1500, refundedMinor: 0, totalMinor: 1500 };
describe("simple order actions", () => {
  it("offers confirmation first and a single delivery action for existing confirmed or in-transit orders", () => {
    expect(quickOrderAction({ ...order, status: "WHATSAPP_PENDING", inventoryState: "RESERVED" })?.input).toEqual({ action: "status", status: "CONFIRMED" });
    for (const status of ["CONFIRMED", "PREPARING", "SHIPPED"]) expect(quickOrderAction({ ...order, status })).toEqual({ label: "Çatdırıldı", input: { action: "deliver" } });
    expect(quickOrderAction({ ...order, inventoryState: "RESERVED" })).toBeNull();
  });
  it("offers one-click completion for an already-delivered legacy order only after full net payment", () => {
    const delivered = { ...order, status: "DELIVERED", deliveryStatus: "DELIVERED" };
    expect(quickOrderAction(delivered)?.input).toEqual({ action: "status", status: "COMPLETED" });
    expect(quickOrderAction({ ...delivered, paidMinor: 500 })).toBeNull();
    expect(quickOrderAction({ ...delivered, refundedMinor: 100 })).toBeNull();
    expect(quickOrderAction({ ...delivered, inventoryState: "RELEASED" })).toBeNull();
  });
  it("never offers a progress action for completed, canceled or returned orders", () => {
    for (const status of ["COMPLETED", "CANCELED", "RETURNED"]) expect(quickOrderAction({ ...order, status })).toBeNull();
  });
  it("keeps generic status skips blocked; physical delivery is a separate explicit action", () => {
    expect(transitions.CONFIRMED).not.toContain("COMPLETED"); expect(transitions.CONFIRMED).not.toContain("DELIVERED");
  });
});
