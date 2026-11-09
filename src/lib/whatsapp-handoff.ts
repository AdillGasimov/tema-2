type Device = { userAgent: string; platform?: string; maxTouchPoints?: number };

export function whatsappHandoff(sourceUrl: string, device: Device, plainMessage?: string) {
  const source = new URL(sourceUrl);
  const message = plainMessage ?? source.searchParams.get("text") ?? "";
  const phone = source.pathname.replace(/\//g, "");
  const mobile = /Android|iPhone|iPad|iPod/i.test(device.userAgent)
    || (device.platform === "MacIntel" && (device.maxTouchPoints ?? 0) > 1);
  // Desktop opens Web directly, avoiding the short-link/native-app redirect.
  // Encode the original Unicode text once; it is also available for copying.
  const url = mobile ? sourceUrl : `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`;
  return { url, message };
}
