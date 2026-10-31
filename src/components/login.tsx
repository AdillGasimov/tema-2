"use client";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
export function LoginForm() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); const f = new FormData(e.currentTarget);
    try { const result = await createAuthClient().signIn.email({ email: String(f.get("email")).includes("@") ? String(f.get("email")) : `${String(f.get("email")).toLowerCase()}@partners.invalid`, password: String(f.get("password")) });
      if (result.error) { setError("E-poçt və ya parol düzgün deyil. Yenidən yoxlayın."); return; }
      router.push("/account"); router.refresh();
    } catch { setError("Giriş alınmadı. Yenidən cəhd edin."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="login-form"><span className="login-icon"><LockKeyhole size={24} /></span><p className="eyebrow">TƏHLÜKƏSİZ GİRİŞ</p><h1>Yenidən xoş gəlmisiniz.</h1><p>Administrator və tərəfdaş hesabınıza daxil olun.</p><label className="field">E-poçt və ya referal kodu<input name="email" type="text" autoComplete="username" required /></label><label className="field">Parol<input name="password" type="password" autoComplete="current-password" maxLength={128} required /></label>{error && <p role="alert" className="error-message">{error}</p>}<button className="btn btn-dark full" disabled={busy}>{busy ? "Yoxlanılır…" : "Daxil ol"}<ArrowRight size={18} /></button><p className="form-hint">Hesabınızı mağaza administratoru yaradır. Parolunuzu unutmusunuzsa, mağaza ilə əlaqə saxlayın.</p></form>;
}
