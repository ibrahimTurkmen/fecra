import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle, Inbox } from 'lucide-react';
const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{message:string; error:boolean} | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);
  return <ToastContext.Provider value={(message, error = false) => setToast({ message, error })}>{children}{toast && <div className={`toast ${toast.error ? 'error' : ''}`} role="status">{toast.error ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}<span>{toast.message}</span><button className="icon-button" aria-label="Mesajı kapat" onClick={() => setToast(null)}><X size={16}/></button></div>}</ToastContext.Provider>;
}
export function useAction() { const toast = useContext(ToastContext); return (fn: () => unknown, success?: string) => { try { fn(); if (success) toast(success); return true; } catch (e) { toast(e instanceof Error ? e.message : 'İşlem tamamlanamadı.', true); return false; } }; }
export const useToast = () => useContext(ToastContext);
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const label = String(children); const color = tone ?? (['Onaylandı','Sevk Edildi','Tamamlandı','Normal','Aktif'].includes(label) ? 'green' : ['Reddedildi','İptal','Kritik','Yüksek'].includes(label) ? 'red' : ['Onay Bekliyor','Bekliyor','Düşük marj','Devam Ediyor'].includes(label) ? 'amber' : 'gray');
  return <span className={`badge ${color}`}>{children}</span>;
}
export function PageTitle({ eyebrow, title, description, actions }: { eyebrow?:string; title:string; description:string; actions?:ReactNode }) {
  return <div className="page-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div><div className="actions">{actions}</div></div>;
}
export function Panel({ title, subtitle, action, children, className = '' }: { title:string; subtitle?:string; action?:ReactNode; children:ReactNode; className?:string }) { return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>; }
export function Empty({ children }: { children:ReactNode }) { return <div className="empty"><Inbox size={28}/><p>{children}</p></div>; }
export function Drawer({ title, subtitle, children, close, wide = false }: { title:string; subtitle?:string; children:ReactNode; close:()=>void; wide?:boolean }) {
  const ref = useRef<HTMLDivElement>(null); const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement; const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') { const nodes = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'); if (!nodes?.length) return; const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener('keydown', onKey); return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabIndex={-1} ref={ref}><div className="drawer-head"><div><div className="eyebrow">FECRA OPERATIONS</div><h2 id="drawer-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={close} aria-label="Pencereyi kapat"><X/></button></div><div className="drawer-content">{children}</div></div></div>;
}
export function Field({ label, children, hint }: { label:string; children:ReactNode; hint?:string }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
