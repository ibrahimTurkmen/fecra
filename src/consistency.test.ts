import { describe, expect, it } from 'vitest';
import { seed, money, percent, metrics, salesTrend, recordImportErrors, importProducts, validateRows, createOrder, transitionOrder, requestPrice, decidePrice, available } from './domain';
import { migrateDemoData } from './migration';
describe('Demo temizliği ve kalıcı state geçişi', () => {
  it('eski dosya, görev ve bağlı bildirim/geçmiş kayıtlarını birlikte temizler', () => {
    const s = seed(); const filename = 'eski-calisma-listesi.xlsx';
    recordImportErrors(s, filename, 1); const task = s.tasks.find(t => t.source === `import:${filename}`)!;
    s.events.push({ id:'EVT-9001', title:'Görev güncellendi', detail:`${task.id} · Devam Ediyor`, at:task.createdAt, role:'Operasyon' });
    s.products[1].cost = 542; const products = structuredClone(s.products), orders = structuredClone(s.orders), requests = structuredClone(s.requests);
    const cleaned = migrateDemoData(s);
    expect(JSON.stringify(cleaned)).not.toContain(filename); expect(cleaned.tasks.some(t => t.id === task.id)).toBe(false);
    expect(cleaned.events.some(e => e.detail.includes(task.id))).toBe(false);
    expect(cleaned.products).toEqual(products); expect(cleaned.orders).toEqual(orders); expect(cleaned.requests).toEqual(requests);
    expect(migrateDemoData(cleaned)).toEqual(cleaned);
  });
  it('FECRA aktarım kayıtlarını korur ve eski geçmişlere durum ekler', () => {
    const s = seed(); s.imports = [{ id:'IMP-8000', name:'fecra-urun-kontrol.xlsx', added:0, updated:2, errors:0, at:'2026-10-08T07:00:00Z' } as typeof s.imports[number]];
    const cleaned = migrateDemoData(s);
    expect(cleaned.imports.find(i => i.id === 'IMP-8000')?.status).toBe('Tamamlandı');
  });
  it('FECRA örnek hataları görev, geçmiş, olay ve bildirimde aynı dosya/sayıyı kullanır', () => {
    const s = seed(); expect(s.imports).toHaveLength(2);
    for (const i of s.imports) {
      expect(i.name).toMatch(/^fecra-/); expect(i.status).toBe('Kontrol Gerekli');
      expect(s.tasks.find(t => t.source === `import:${i.name}`)?.title).toContain(`${i.errors} hatalı satırı`);
      expect(s.events.find(e => e.detail.startsWith(i.name))?.detail).toContain(`${i.errors} hatalı satır`);
      expect(s.notifications.some(n => n.title.startsWith(i.name))).toBe(true);
      expect(s.tasks.find(t => t.source === `import:${i.name}`)?.createdAt).toBe(i.at);
      expect(s.events.find(e => e.rule === 'import' && e.detail.startsWith(i.name))?.at).toBe(i.at);
    }
    expect(s.imports.map(i => i.errors).sort()).toEqual([1,2]);
    expect(seed()).toEqual(s);
  });
});
describe('Para formatı ve rapor tutarlılığı', () => {
  it.each([[8220,'₺8.220,00'],[68360,'₺68.360,00'],[1190,'₺1.190,00'],[580,'₺580,00']])('Türkiye para formatı: %s', (value, expected) => { expect(money(Number(value))).toBe(expected); });
  it('geçici geçersiz form değerlerini NaN olarak göstermez', () => { expect(money(NaN)).toBe('—'); expect(percent(Infinity)).toBe('—'); });
  it('seçilen grafiğin toplamı aynı dönem ve aynı state verisinden hesaplanır', () => {
    const s = seed(); expect(salesTrend(s,7).reduce((n,p) => n+p.Satış,0)).toBe(metrics(s).revenue);
    expect(salesTrend(s,3)).toHaveLength(3);
    const previous = salesTrend(s,3).reduce((n,p) => n+p.Satış,0);
    const id = createOrder(s,'FECRA Demo Müşterisi','FECRA Web',[{productId:'FCR-1002',quantity:2}]); transitionOrder(s,id,'Onaylandı');
    expect(salesTrend(s,3).reduce((n,p) => n+p.Satış,0)).toBe(previous+2180);
  });
  it('operasyon KPI yalnızca açık Operasyon görevlerini sayar', () => { const s=seed(); expect(metrics(s).tasks).toBe(s.tasks.filter(t=>t.team==='Operasyon'&&t.status!=='Tamamlandı').length); expect(s.tasks.some(t=>t.team==='Yönetici')).toBe(true); });
});
describe('Aktarım ve işlem tekilliği', () => {
  it('hata → düzeltilmiş önizleme → aktarım aynı geçmiş ve görevi sonuçlandırır', () => {
    const s = seed(); s.role='Operasyon'; const name=s.imports[0].name; const historyId=s.imports[0].id;
    recordImportErrors(s,name,3); expect(s.tasks.find(t=>t.source===`import:${name}`)?.title).toContain('3 hatalı');
    recordImportErrors(s,name,0); expect(s.imports.find(i=>i.id===historyId)?.status).toBe('Doğrulandı');
    const p=s.products[1]; const rows=validateRows([{'Ürün Kodu':p.id,'Ürün Adı':p.name,Kategori:p.category,Stok:85,'Alış Maliyeti':530}],s.products);
    importProducts(s,rows,name);
    expect(s.imports.find(i=>i.id===historyId)).toMatchObject({status:'Tamamlandı',errors:0,updated:1});
    expect(s.imports.filter(i=>i.name===name)).toHaveLength(1);
    expect(s.tasks.find(t=>t.source===`import:${name}`)?.status).toBe('Tamamlandı');
  });
  it('fiyat onayı görevi karar ile kapanır; karar tekrar uygulanamaz', () => {
    const s=seed();s.role='Yönetici';const r=s.requests[0];decidePrice(s,r.id,true,'FECRA kampanyası uygun.');
    expect(s.tasks.find(t=>t.source===`price:${r.id}`)?.status).toBe('Tamamlandı');
    const snapshot=structuredClone(s);expect(()=>decidePrice(s,r.id,false,'')).toThrow();expect(s).toEqual(snapshot);
  });
  it('aynı normal fiyat ikinci kez uygulanmaz', () => {const s=seed(),p=s.products[1];requestPrice(s,p.id,1500,p,25,'');const count=s.requests.length;expect(()=>requestPrice(s,p.id,1500,p,25,'')).toThrow(/zaten aktif/);expect(s.requests).toHaveLength(count);});
  it('kuruşa yuvarlanınca sıfır olan fiyatı reddeder', () => {const s=seed(),p=s.products[1];expect(()=>requestPrice(s,p.id,0.001,p,25,'')).toThrow();});
  it('bozuk rezervasyondan negatif stok üretmez', () => {
    const s=seed();s.role='Operasyon';const o=s.orders.find(o=>o.status==='Onaylandı')!;const p=s.products.find(p=>p.id===o.lines[0].productId)!;p.reserved=0;
    const snapshot=structuredClone(s);expect(()=>transitionOrder(s,o.id,'Sevk Edildi')).toThrow(/rezervasyonu/);expect(s).toEqual(snapshot);
  });
  it('eşik altına düşüş stok görevi üretir, aynı açık görevi çoğaltmaz', () => {
    const s=seed(),p=s.products[1];const id=createOrder(s,'FECRA Toplu Satış','Manuel Satış',[{productId:p.id,quantity:p.stock-p.threshold}]);
    transitionOrder(s,id,'Onaylandı');expect(available(p)).toBe(p.threshold);
    expect(s.tasks.filter(t=>t.source===`stock:${p.id}`&&t.status!=='Tamamlandı')).toHaveLength(1);
    s.role='Operasyon';transitionOrder(s,id,'Sevk Edildi');expect(s.tasks.filter(t=>t.source===`stock:${p.id}`&&t.status!=='Tamamlandı')).toHaveLength(1);
  });
});
