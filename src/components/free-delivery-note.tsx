import { freeDeliveryMessage } from "@/lib/delivery";

export function FreeDeliveryNote({ regions }: { regions: string }) {
  const message = freeDeliveryMessage(regions);
  return message ? <p className="form-hint free-delivery-note">{message}</p> : null;
}
