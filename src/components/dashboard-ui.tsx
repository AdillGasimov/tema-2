"use client";
import { useState, isValidElement, cloneElement, type FormEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Plus, PackageOpen } from "lucide-react";
import { label, toMinor } from "@/lib/money";
export function Badge({ value }: { value: string }) { return <span className={`badge badge-${value.toLowerCase()}`}>{label(value)}</span>; }
export function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="dashboard-title"><div><p className="eyebrow">İDARƏETMƏ</p><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>; }
export function Empty({ text = "Hələ heç bir qeyd yoxdur." }: { text?: string }) { return <div className="panel-empty"><PackageOpen size={32} strokeWidth={1} /><p>{text}</p></div>; }
export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="table-scroll"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
export function Field({ label, name, value, type = "text", required = false, hint, children, ...props }: { label: string; name?: string; value?: string | number; type?: string; required?: boolean; hint?: string; children?: React.ReactNode; min?: number; max?: number; maxLength?: number; step?: string }) { return <label className="field">{label}{(children && isValidElement(children) ? cloneElement(children as ReactElement<{ "aria-label"?: string }>, { "aria-label": label }) : children) ?? <input aria-label={label} name={name} type={type} defaultValue={value} required={required} {...props} />}{hint && <small>{hint}</small>}</label>; }
export function MoneyField({ label, name, minor, required = true }: { label: string; name: string; minor?: number | null; required?: boolean }) { return <Field label={`${label} (AZN)`} name={name} value={minor === null || minor === undefined ? "" : (minor / 100).toFixed(2)} type="text" required={required} maxLength={10} hint="Məsələn: 12.50" />; }
export function readMoney(f: FormData, key: string) { return toMinor(String(f.get(key) ?? "0")); }
export function optionalMoney(f: FormData, key: string) { const value = String(f.get(key) ?? ""); return value ? toMinor(value) : null; }
export async function api(resource: string, data: unknown) { const r = await fetch(`/api/admin/${resource}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }
export function useMutation(resource: string) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [success, setSuccess] = useState(""); const router = useRouter();
  async function run(data: unknown, after?: (result: unknown) => void) { setBusy(true); setError(""); setSuccess(""); try { const result: unknown = await api(resource, data); setSuccess("Yadda saxlanıldı."); after?.(result); router.refresh(); return result; } catch (e) { setError(e instanceof Error ? e.message : "Əməliyyat alınmadı."); return null; } finally { setBusy(false); } }
  return { run, error, busy, success, setError };
}
export function MutationFeedback({ error, success }: { error: string; success: string }) { return <><p className="error-message" role={error ? "alert" : undefined}>{error}</p><p className="success-message" role="status">{success}</p></>; }
export function SaveButton({ busy, text = "Yadda saxla" }: { busy: boolean; text?: string }) { return <button className="btn btn-dark" disabled={busy} type="submit">{busy ? "Saxlanılır…" : text}<Plus size={16} /></button>; }
export function ActionForm({ resource, build, children, text }: { resource: string; build: (f: FormData) => unknown; children: React.ReactNode; text?: string }) {
  const m = useMutation(resource);
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); try { await m.run(build(new FormData(e.currentTarget))); } catch (err) { m.setError(err instanceof Error ? err.message : "Məlumatları yoxlayın."); } }
  return <form onSubmit={submit} className="action-form">{children}<MutationFeedback {...m} /><SaveButton busy={m.busy} text={text} /></form>;
}
