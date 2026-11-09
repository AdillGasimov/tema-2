"use client";
import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

export function WhatsAppOrderActions({ url, message }: { url: string; message: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [showMessage, setShowMessage] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(message); setCopyState("copied"); }
    catch { setCopyState("failed"); setShowMessage(true); }
  }
  return <>
    <div className="whatsapp-order-actions">
      <a className="btn btn-dark" href={url} target="_blank" rel="noreferrer"><MessageCircle size={18} />{url.startsWith("https://web.whatsapp.com/") ? "WhatsApp Web-də aç" : "WhatsApp-da aç"}</a>
      <button type="button" className="btn btn-outline" onClick={copy}>{copyState === "copied" ? <Check size={18} /> : <Copy size={18} />}Mesajı kopyala</button>
    </div>
    {copyState === "copied" && <p role="status" className="whatsapp-copy-feedback">Mesaj emojilərlə birlikdə kopyalandı.</p>}
    {copyState === "failed" && <p role="alert" className="error-message">Avtomatik kopyalama alınmadı. Aşağıdakı mətni seçib əl ilə kopyalayın.</p>}
    <details className="whatsapp-order-preview" open={showMessage} onToggle={event => setShowMessage(event.currentTarget.open)}>
      <summary>Sifariş mesajına bax</summary>
      <textarea aria-label="Sifariş mesajı" readOnly rows={10} value={message} onFocus={event => event.currentTarget.select()} />
    </details>
  </>;
}
