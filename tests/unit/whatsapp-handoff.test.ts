import { describe, expect, it } from "vitest";
import { whatsappHandoff } from "../../src/lib/whatsapp-handoff";

const message = "Salam! 👋\n🧾 *Sifariş:* TEST-1\n🛍️ Şüşə spreyi × 2\n💰 10,00\u00a0₼\n🚚 28 May: Ödənişsiz\n📞 +994501234567\nQeyd: A&B #12 + qapı 🔔\n✅";
const phone = "994500000000";
const source = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
describe("WhatsApp Unicode handoff", () => {
  it.each(["Mozilla/5.0 Windows NT 10.0 Chrome/138", "Mozilla/5.0 Macintosh Safari/605", "Mozilla/5.0 X11 Linux Firefox/138"])("opens Web directly on desktop and preserves the full draft", userAgent => {
    const handoff = whatsappHandoff(source, { userAgent }, message), target = new URL(handoff.url);
    expect(target.origin + target.pathname).toBe("https://web.whatsapp.com/send");
    expect(target.searchParams.get("phone")).toBe(phone);
    expect(target.searchParams.get("text")).toBe(message); expect(handoff.message).toBe(message);
    expect(handoff.message).not.toContain("\ufffd"); expect(target.searchParams.get("text")).not.toContain("%F0");
  });
  it.each([
    { userAgent: "Mozilla/5.0 Android 14 Chrome/138" }, { userAgent: "Mozilla/5.0 iPhone CPU iPhone OS 18" },
    { userAgent: "Mozilla/5.0 iPad CPU OS 18" }, { userAgent: "Mozilla/5.0 Macintosh Safari/605", platform: "MacIntel", maxTouchPoints: 5 },
  ])("retains the phone app handoff on mobile", device => {
    const handoff = whatsappHandoff(source, device, message);
    expect(handoff.url).toBe(source); expect(handoff.message).toBe(message);
  });
  it("supports an older API response without a separate plain message", () => {
    const handoff = whatsappHandoff(source, { userAgent: "Desktop" });
    expect(handoff.message).toBe(message); expect(new URL(handoff.url).searchParams.get("text")).toBe(message);
  });
  it("uses the original plain message for the desktop draft and clipboard", () => {
    const oldUrl = `https://wa.me/${phone}?text=${encodeURIComponent("Salam! �")}`;
    const handoff = whatsappHandoff(oldUrl, { userAgent: "Desktop" }, message);
    expect(handoff.message).toBe(message); expect(new URL(handoff.url).searchParams.get("text")).toBe(message);
  });
});
