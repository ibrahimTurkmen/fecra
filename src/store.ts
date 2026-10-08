import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seed, requestPrice, decidePrice, createOrder, transitionOrder, adjustStock, importProducts, recordImportErrors, now } from './domain';
import type { Data, Role, Costs, OrderStatus, ImportRow, Task } from './domain';
import { migrateDemoData } from './migration';
interface Store extends Data {
  setRole: (role: Role) => void; reset: () => void;
  requestPrice: (id: string, price: number, costs: Costs, target: number, note: string) => string;
  decidePrice: (id: string, approve: boolean, note: string) => void;
  createOrder: (customer: string, channel: string, items: {productId: string; quantity: number}[]) => string;
  transitionOrder: (id: string, status: OrderStatus) => void;
  adjustStock: (id: string, stock: number, reason: string) => void;
  importProducts: (rows: ImportRow[], name: string) => void;
  recordImportErrors: (name: string, errors: number) => void;
  setTask: (id: string, status: Task['status']) => void;
  markRead: () => void;
}
function data(s: Data): Data { return { products:s.products, orders:s.orders, requests:s.requests, tasks:s.tasks, events:s.events, notifications:s.notifications, imports:s.imports, sequence:s.sequence, role:s.role }; }
export const useStore = create<Store>()(persist<Store, [], [], Data>((set, get) => {
  function transact<T>(fn: (s: Data) => T): T { const draft = structuredClone(data(get())); const result = fn(draft); set(draft); return result; }
  return { ...seed(), setRole: role => { if (!['Satış', 'Operasyon', 'Yönetici'].includes(role)) throw new Error('Geçersiz demo rolü.'); set({ role }); }, reset: () => set(seed()),
    requestPrice: (...args) => transact(s => requestPrice(s, ...args)), decidePrice: (...args) => transact(s => decidePrice(s, ...args)),
    createOrder: (...args) => transact(s => createOrder(s, ...args)), transitionOrder: (...args) => transact(s => transitionOrder(s, ...args)),
    adjustStock: (...args) => transact(s => adjustStock(s, ...args)), importProducts: (...args) => transact(s => importProducts(s, ...args)),
    recordImportErrors: (...args) => transact(s => recordImportErrors(s, ...args)),
    setTask: (id, status) => transact(s => { const t = s.tasks.find(t => t.id === id); if (!t) throw new Error('Görev bulunamadı.'); if (!['Bekliyor', 'Devam Ediyor', 'Tamamlandı'].includes(status)) throw new Error('Geçersiz görev durumu.'); if (s.role !== 'Yönetici' && t.team !== s.role) throw new Error(`${t.team} veya Yönetici rolüne geçin.`); if (t.status === status) return; if (t.source.startsWith('price:') && status === 'Tamamlandı' && s.requests.some(r => `price:${r.id}` === t.source && r.status === 'Onay Bekliyor')) throw new Error('Önce Onay Merkezi’nde fiyat talebini sonuçlandırın.'); t.status = status; s.events.unshift({ id: `EVT-${++s.sequence}`, title:'Görev güncellendi', detail:`${t.id} · ${status}`, role:s.role, at:now() }); }),
    markRead: () => transact(s => { s.notifications.filter(n => n.team === s.role || s.role === 'Yönetici').forEach(n => { n.read = true; }); }),
  };
}, { name: 'fecra-operations-v1', version: 2, storage: createJSONStorage(() => localStorage), partialize: data, migrate: previous => migrateDemoData(previous as Data) }));
