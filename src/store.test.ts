import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useStore as Store } from './store';
let useStore: typeof Store;
const values=new Map<string,string>();
beforeAll(async()=>{vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});useStore=(await import('./store')).useStore;});
beforeEach(()=>useStore.getState().reset());
describe('Store rol, işlem bütünlüğü ve kalıcılık',()=>{
  it('Satış rolü yönetici kararını uygulayamaz ve store değişmez',()=>{const s=useStore.getState();const serialized=values.get('fecra-operations-v1');expect(()=>s.decidePrice(s.requests[0].id,true,'')).toThrow(/Yönetici/);expect(values.get('fecra-operations-v1')).toBe(serialized);});
  it('Operasyon fiyat talebi veya yeni satış siparişi oluşturamaz',()=>{useStore.getState().setRole('Operasyon');const s=useStore.getState();expect(()=>s.requestPrice(s.products[1].id,790,s.products[1],25,'')).toThrow();expect(()=>s.createOrder('FECRA Müşteri','FECRA Web',[{productId:s.products[1].id,quantity:1}])).toThrow();});
  it('Satış stok düzeltemez ve sevkiyat yapamaz',()=>{const s=useStore.getState();expect(()=>s.adjustStock(s.products[0].id,150,'Sayım')).toThrow();expect(()=>s.transitionOrder(s.orders.find(o=>o.status==='Onaylandı')!.id,'Sevk Edildi')).toThrow();});
  it('görev rolü ve fiyat talebi kapanışını denetler',()=>{const s=useStore.getState(),task=s.tasks.find(t=>t.source.startsWith('price:'))!;expect(()=>s.setTask(task.id,'Devam Ediyor')).toThrow();s.setRole('Yönetici');expect(()=>useStore.getState().setTask(task.id,'Tamamlandı')).toThrow(/Onay Merkezi/);});
  it('bozuk satır içeren aktarım state üzerinde kısmi değişiklik bırakmaz',()=>{useStore.getState().setRole('Operasyon');const s=useStore.getState(),snapshot=JSON.stringify(s.products);expect(()=>s.importProducts([{row:2,id:'FCR-1002',name:'Fecra Ritim',category:'Kahve & Çay',stock:-1,cost:530,price:1090,errors:[],existing:true}],'fecra-stok.csv')).toThrow();expect(JSON.stringify(useStore.getState().products)).toBe(snapshot);});
  it('migrasyonu kalıcılaştırır, yeniden açılışta yabancı dosya kayıtları geri gelmez',async()=>{
    const s=useStore.getState();s.recordImportErrors('eski-aktarim-denemesi.csv',1);
    const persisted=JSON.parse(values.get('fecra-operations-v1')!);persisted.version=1;values.set('fecra-operations-v1',JSON.stringify(persisted));
    await useStore.persist.rehydrate();expect(values.get('fecra-operations-v1')).not.toContain('eski-aktarim-denemesi.csv');
    expect(JSON.parse(values.get('fecra-operations-v1')!).version).toBe(2);
    const current=values.get('fecra-operations-v1');await useStore.persist.rehydrate();expect(values.get('fecra-operations-v1')).toBe(current);
  });
  it('reset finansal verileri ve deterministik FECRA örneklerini geri getirir',()=>{const initial=JSON.parse(values.get('fecra-operations-v1')!).state;useStore.getState().setRole('Yönetici');useStore.getState().adjustStock('FCR-1002',999,'Depo sayımı');useStore.getState().reset();expect(JSON.parse(values.get('fecra-operations-v1')!).state).toEqual(initial);});
});
