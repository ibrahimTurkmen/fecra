export type Role = 'Satış' | 'Operasyon' | 'Yönetici';
export type OrderStatus = 'Taslak' | 'Onaylandı' | 'Sevk Edildi' | 'İptal';
export type ApprovalStatus = 'Onay Bekliyor' | 'Onaylandı' | 'Reddedildi';
export interface Costs { cost: number; commission: number; packaging: number; shipping: number; other: number }
export interface Product extends Costs { id: string; name: string; category: string; stock: number; reserved: number; price: number; threshold: number }
export interface PriceRequest { id: string; productId: string; productName: string; oldPrice: number; price: number; costs: Costs; target: number; margin: number; status: ApprovalStatus; note: string; decision: string; createdAt: string; decidedAt?: string; automatic?: boolean }
export interface OrderLine { productId: string; name: string; quantity: number; price: number; contribution: number }
export interface Order { id: string; customer: string; channel: string; lines: OrderLine[]; status: OrderStatus; createdAt: string }
export interface Task { id: string; title: string; team: Role; status: 'Bekliyor' | 'Devam Ediyor' | 'Tamamlandı'; priority: 'Yüksek' | 'Normal'; source: string; createdAt: string }
export interface Event { id: string; title: string; detail: string; at: string; role: Role; rule?: string }
export interface Notification { id: string; title: string; at: string; team: Role; read: boolean }
export interface ImportRecord { id: string; name: string; added: number; updated: number; errors: number; at: string; status: 'Kontrol Gerekli' | 'Doğrulandı' | 'Tamamlandı' }
export interface Data { products: Product[]; orders: Order[]; requests: PriceRequest[]; tasks: Task[]; events: Event[]; notifications: Notification[]; imports: ImportRecord[]; sequence: number; role: Role }
export const DEMO_DAY = '2026-10-08';
export const channels = ['FECRA Web', 'Pazaryeri', 'Manuel Satış'];
export const rules = [
  { id: 'stock', event: 'Kritik stok oluştu', condition: 'Kullanılabilir stok ≤ eşik', action: 'Operasyon ekibine stok görevi' },
  { id: 'price', event: 'Fiyat talebi oluşturuldu', condition: 'Katkı marjı < %20', action: 'Yöneticiye onay bildirimi' },
  { id: 'approved', event: 'Fiyat onaylandı', condition: 'Talep onaylandı', action: 'Satış ekibine bildirim' },
  { id: 'shipped', event: 'Sipariş sevk edildi', condition: 'Onaylı sipariş sevk edildi', action: 'Sevkiyat görevini tamamla' },
  { id: 'import', event: 'Aktarım doğrulandı', condition: 'Hatalı satır bulundu', action: 'Veri kontrol görevi oluştur' },
];
const currencyFormatter = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n: number) => Number.isFinite(n) ? currencyFormatter.format(n) : '—';
export const percent = (n: number) => Number.isFinite(n) ? `%${n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}` : '—';
export const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const available = (p: Product) => p.stock - p.reserved;
export const now = () => `${DEMO_DAY}T${new Date().toISOString().split('T')[1]}`;
export const dateLabel = (at: string) => new Date(at).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
export function calculate(price: number, c: Costs) {
  const commissionAmount = round(price * c.commission / 100);
  const total = round(c.cost + commissionAmount + c.packaging + c.shipping + c.other);
  const contribution = round(price - total);
  return { commissionAmount, total, contribution, margin: price > 0 ? contribution / price * 100 : 0 };
}
export const orderTotal = (o: Order) => round(o.lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
export const orderContribution = (o: Order) => round(o.lines.reduce((sum, l) => sum + l.contribution * l.quantity, 0));
export const orderMargin = (o: Order) => orderTotal(o) ? orderContribution(o) / orderTotal(o) * 100 : 0;
export const salesOrders = (s: Data) => s.orders.filter(o => ['Onaylandı', 'Sevk Edildi'].includes(o.status));
export function metrics(s: Data) {
  const sales = salesOrders(s); const revenue = sales.reduce((a, o) => a + orderTotal(o), 0);
  return { daily: sales.filter(o => o.createdAt.slice(0, 10) === DEMO_DAY).reduce((a, o) => a + orderTotal(o), 0), open: s.orders.filter(o => ['Taslak', 'Onaylandı'].includes(o.status)).length,
    critical: s.products.filter(p => available(p) <= p.threshold).length, pending: s.requests.filter(r => r.status === 'Onay Bekliyor').length,
    margin: revenue ? sales.reduce((a, o) => a + orderContribution(o), 0) / revenue * 100 : 0, tasks: s.tasks.filter(t => t.team === 'Operasyon' && t.status !== 'Tamamlandı').length, revenue };
}
export function salesTrend(s: Data, days = 7) {
  const sales = salesOrders(s);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(`${DEMO_DAY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - days + 1 + i);
    const orders = sales.filter(o => o.createdAt.slice(0, 10) === d.toISOString().slice(0, 10));
    return { day: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' }), Satış: round(orders.reduce((n, o) => n + orderTotal(o), 0)), Katkı: round(orders.reduce((n, o) => n + orderContribution(o), 0)) };
  });
}
function id(s: Data, prefix: string) { return `${prefix}-${String(++s.sequence).padStart(4, '0')}`; }
function log(s: Data, title: string, detail: string, rule?: string) { s.events.unshift({ id: id(s, 'EVT'), title, detail, rule, role: s.role, at: now() }); }
function notify(s: Data, title: string, team: Role) { s.notifications.unshift({ id: id(s, 'NTF'), title, team, at: now(), read: false }); }
function task(s: Data, title: string, source: string, team: Role = 'Operasyon') {
  if (!s.tasks.some(t => t.source === source && t.status !== 'Tamamlandı')) s.tasks.unshift({ id: id(s, 'TSK'), title, team, source, status: 'Bekliyor', priority: source.startsWith('stock') ? 'Yüksek' : 'Normal', createdAt: now() });
}
export function scanStock(s: Data) {
  s.products.forEach(p => {
    const source = `stock:${p.id}`;
    if (available(p) <= p.threshold && !s.tasks.some(t => t.source === source && t.status !== 'Tamamlandı')) {
      task(s, `${p.name.replace('Fecra ', '')} için stok planla`, source);
      log(s, 'Kritik stok görevi oluşturuldu', `${p.id} · ${available(p)} adet kullanılabilir stok`, 'stock');
      notify(s, `${p.id} kritik stok seviyesinde: ${available(p)} adet`, 'Operasyon');
    } else if (available(p) > p.threshold) s.tasks.filter(t => t.source === source && t.status !== 'Tamamlandı').forEach(t => { t.status = 'Tamamlandı'; });
  });
}
function requireRole(s: Data, allowed: Role[]) { if (!allowed.includes(s.role)) throw new Error(`Bu işlem için ${allowed.join(' veya ')} rolüne geçin.`); }
function finite(n: number, label: string, positive = false) { if (!Number.isFinite(n) || (positive ? n <= 0 : n < 0) || n > 100000000) throw new Error(`${label} için geçerli ${positive ? 'pozitif' : 'sıfır veya pozitif'} bir sayı girin.`); }
export function requestPrice(s: Data, productId: string, price: number, costs: Costs, target: number, note: string) {
  requireRole(s, ['Satış', 'Yönetici']); const p = s.products.find(p => p.id === productId); if (!p) throw new Error('Ürün bulunamadı.');
  costs = { cost: costs.cost, commission: costs.commission, packaging: costs.packaging, shipping: costs.shipping, other: costs.other };
  price = round(price);
  finite(price, 'Fiyat', true); Object.entries(costs).forEach(([k, v]) => finite(v, k));
  if (costs.cost !== p.cost) throw new Error('Ürün maliyeti değişti. Senaryoyu yeniden açın.');
  if (costs.commission >= 100 || !Number.isFinite(target) || target < 0 || target >= 100) throw new Error('Komisyon ve hedef marj %0–99 arasında olmalı.');
  if (s.requests.some(r => r.productId === productId && r.status === 'Onay Bekliyor')) throw new Error('Bu ürün için bekleyen bir fiyat talebi var. Önce bu talebi sonuçlandırın.');
  if (price === p.price && Object.entries(costs).every(([key, value]) => p[key as keyof Costs] === value)) throw new Error('Bu fiyat ve giderler zaten aktif. Değişiklik yapılmadı.');
  const result = calculate(price, costs); const pending = result.margin < 20;
  const r: PriceRequest = { id: id(s, 'FYT'), productId, productName: p.name, oldPrice: p.price, price: round(price), costs: { ...costs }, target, margin: result.margin, status: pending ? 'Onay Bekliyor' : 'Onaylandı', note: note.trim(), decision: pending ? '' : 'Demo kuralı: marj ≥ %20, doğrudan uygulandı.', createdAt: now(), automatic: !pending, ...(!pending ? { decidedAt: now() } : {}) };
  s.requests.unshift(r);
  if (pending) { task(s, `${r.id} · ${p.name} fiyat talebini değerlendir`, `price:${r.id}`, 'Yönetici'); log(s, 'Fiyat talebi onaya gönderildi', `${r.id} · ${p.id} · ${money(price)} · ${percent(result.margin)} marj`, 'price'); notify(s, `${r.id}: ${p.name} fiyat onayı bekliyor`, 'Yönetici'); }
  else { Object.assign(p, costs, { price: round(price) }); log(s, 'Fiyat güncellendi', `${p.id} · ${money(price)}`, 'approved'); notify(s, `${p.id} fiyatı ${money(price)} olarak güncellendi`, 'Satış'); }
  return r.id;
}
export function decidePrice(s: Data, requestId: string, approve: boolean, decision: string) {
  requireRole(s, ['Yönetici']); const r = s.requests.find(r => r.id === requestId);
  if (!r || r.status !== 'Onay Bekliyor') throw new Error('Bu talep zaten sonuçlandırılmış veya bulunamadı.');
  const p = s.products.find(p => p.id === r.productId)!;
  if (!p) throw new Error('Talebin ürün kaydı bulunamadı.');
  if (approve && p.cost !== r.costs.cost) throw new Error('Talep sonrası alış maliyeti değişti. Talebi reddedip güncel maliyetle yeniden oluşturun.');
  r.status = approve ? 'Onaylandı' : 'Reddedildi'; r.decision = decision.trim() || (approve ? 'Yönetici tarafından onaylandı.' : 'Yönetici tarafından reddedildi.'); r.decidedAt = now();
  if (approve) Object.assign(p, r.costs, { price: r.price });
  s.tasks.filter(t => t.source === `price:${r.id}`).forEach(t => { t.status = 'Tamamlandı'; });
  log(s, approve ? 'Fiyat onaylandı' : 'Fiyat reddedildi', `${r.id} · ${r.decision}`, approve ? 'approved' : undefined);
  notify(s, `${r.id} ${r.status.toLocaleLowerCase('tr-TR')}: ${p.name}`, 'Satış');
}
export function createOrder(s: Data, customer: string, channel: string, items: { productId: string; quantity: number }[]) {
  requireRole(s, ['Satış', 'Yönetici']);
  if (!customer.trim() || !channels.includes(channel) || !items.length) throw new Error('Müşteri, kanal ve en az bir ürün gerekli.');
  const merged = new Map<string, number>();
  items.forEach(i => { if (!Number.isSafeInteger(i.quantity) || i.quantity <= 0) throw new Error('Adet pozitif tam sayı olmalı.'); merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity); });
  const lines = [...merged].map(([pid, quantity]) => {
    const p = s.products.find(p => p.id === pid); if (!p) throw new Error('Ürün bulunamadı.');
    if (available(p) < quantity) throw new Error(`${p.name}: kullanılabilir stok yetersiz (${available(p)} adet).`);
    return { productId: pid, name: p.name, quantity, price: p.price, contribution: calculate(p.price, p).contribution };
  });
  const o: Order = { id: id(s, 'SIP'), customer: customer.trim(), channel, lines, status: 'Taslak', createdAt: now() };
  s.orders.unshift(o); log(s, 'Sipariş oluşturuldu', `${o.id} · ${customer} · ${money(orderTotal(o))}`); return o.id;
}
export function transitionOrder(s: Data, orderId: string, next: OrderStatus) {
  const o = s.orders.find(o => o.id === orderId); if (!o) throw new Error('Sipariş bulunamadı.');
  requireRole(s, next === 'Sevk Edildi' ? ['Operasyon', 'Yönetici'] : ['Satış', 'Operasyon', 'Yönetici']);
  const valid = o.status === 'Taslak' && ['Onaylandı', 'İptal'].includes(next) || o.status === 'Onaylandı' && ['Sevk Edildi', 'İptal'].includes(next);
  if (!valid) throw new Error('Bu durum geçişi yapılamaz. Sipariş zaten işlenmiş olabilir.');
  const quantities = new Map<string, number>();
  o.lines.forEach(l => { if (!Number.isSafeInteger(l.quantity) || l.quantity <= 0) throw new Error('Sipariş adedi geçersiz.'); quantities.set(l.productId, (quantities.get(l.productId) ?? 0) + l.quantity); });
  quantities.forEach((quantity, productId) => {
    const p = s.products.find(p => p.id === productId);
    if (!p || !Number.isSafeInteger(p.stock) || !Number.isSafeInteger(p.reserved) || p.stock < p.reserved || p.reserved < 0) throw new Error('Ürün stok kaydı tutarsız.');
    if (next === 'Onaylandı' && available(p) < quantity) throw new Error(`${p.id}: kullanılabilir stok yetersiz.`);
    if (o.status === 'Onaylandı' && (p.reserved < quantity || p.stock < quantity)) throw new Error(`${p.id}: sipariş rezervasyonu yetersiz.`);
  });
  o.lines.forEach(l => {
    const p = s.products.find(p => p.id === l.productId)!;
    if (next === 'Onaylandı') p.reserved += l.quantity;
    if (next === 'Sevk Edildi') { p.stock -= l.quantity; p.reserved -= l.quantity; }
    if (next === 'İptal' && o.status === 'Onaylandı') p.reserved -= l.quantity;
  });
  o.status = next;
  if (next === 'Onaylandı') task(s, `${o.id} siparişini hazırla ve sevk et`, `order:${o.id}`);
  if (next === 'Sevk Edildi' || next === 'İptal') s.tasks.filter(t => t.source === `order:${o.id}`).forEach(t => { t.status = 'Tamamlandı'; });
  log(s, `Sipariş ${next.toLocaleLowerCase('tr-TR')}`, `${o.id} · ${o.customer}`, next === 'Sevk Edildi' ? 'shipped' : undefined);
  if (next === 'Sevk Edildi') notify(s, `${o.id} sevk edildi; stok ve görev kayıtları güncellendi.`, 'Operasyon');
  scanStock(s);
}
export function adjustStock(s: Data, productId: string, stock: number, reason: string) {
  requireRole(s, ['Operasyon', 'Yönetici']); const p = s.products.find(p => p.id === productId);
  if (!p || !Number.isSafeInteger(stock) || stock < 0 || stock < p.reserved) throw new Error('Fiziksel stok, rezerve stoktan az olamaz; sıfır veya pozitif tam sayı girin.');
  if (!reason.trim()) throw new Error('Stok düzeltme nedeni gerekli.');
  const old = p.stock; p.stock = stock; log(s, 'Stok düzeltildi', `${p.id} · ${old} → ${stock} adet · ${reason}`); scanStock(s);
}
export interface ImportRow { row: number; id: string; name: string; category: string; stock: number; cost: number; price: number; errors: string[]; existing: boolean }
export function validateRows(rows: Record<string, unknown>[], products: Product[]): ImportRow[] {
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const text = (k: string) => String(r[k] ?? '').trim();
    const num = (k: string) => { const v = text(k); return v === '' ? NaN : Number(v.replace(',', '.')); };
    const pid = text('Ürün Kodu'), name = text('Ürün Adı'), category = text('Kategori');
    const p = products.find(p => p.id === pid); const stock = num('Stok'), cost = num('Alış Maliyeti'), price = p?.price ?? num('Satış Fiyatı'); const errors: string[] = [];
    if (!pid || !name || !category) errors.push('Ürün kodu, adı ve kategori zorunlu.');
    if (seen.has(pid)) errors.push('Dosyada yinelenen ürün kodu.'); seen.add(pid);
    if (!Number.isSafeInteger(stock) || stock < 0 || stock > 10000000) errors.push('Stok, 0–10.000.000 arası tam sayı olmalı.');
    if (p && stock < p.reserved) errors.push(`Stok, ${p.reserved} adet rezervasyondan az olamaz.`);
    if (!Number.isFinite(cost) || cost < 0 || cost > 100000000) errors.push('Alış maliyeti geçersiz.');
    if (!Number.isFinite(price) || price <= 0 || price > 100000000) errors.push('Yeni ürün için pozitif satış fiyatı gerekli.');
    return { row: i + 2, id: pid, name, category, stock, cost, price, errors, existing: !!p };
  });
}
export function recordImportErrors(s: Data, name: string, errors: number) {
  const existing = s.imports.find(i => i.name === name && i.status !== 'Tamamlandı');
  const status = errors ? 'Kontrol Gerekli' : 'Doğrulandı';
  if (existing) Object.assign(existing, { errors, status, at: now() });
  else s.imports.unshift({ id: id(s, 'IMP'), name, added: 0, updated: 0, errors, status, at: now() });
  if (!errors) { log(s, 'Aktarım doğrulandı', `${name} · Hata yok; aktarım onayı bekleniyor.`); return; }
  const active = s.tasks.find(t => t.source === `import:${name}` && t.status !== 'Tamamlandı');
  if (active) active.title = `${name}: ${errors} hatalı satırı kontrol et`;
  else task(s, `${name}: ${errors} hatalı satırı kontrol et`, `import:${name}`);
  log(s, 'Aktarım doğrulama hatası', `${name} · ${errors} hatalı satır`, 'import'); notify(s, `${name}: veri kontrol görevi oluşturuldu`, 'Operasyon');
}
export function importProducts(s: Data, rows: ImportRow[], name: string) {
  requireRole(s, ['Operasyon', 'Yönetici']);
  if (!rows.length) throw new Error('Dosyada aktarılacak satır yok.');
  const fresh = validateRows(rows.map(r => ({ 'Ürün Kodu': r.id, 'Ürün Adı': r.name, Kategori: r.category, Stok: r.stock, 'Alış Maliyeti': r.cost, 'Satış Fiyatı': r.price })), s.products);
  if (fresh.some(r => r.errors.length)) throw new Error('Hatalı satırları düzeltip dosyayı yeniden yükleyin. Hiçbir kayıt aktarılmadı.');
  let added = 0, updated = 0;
  fresh.forEach(r => {
    const p = s.products.find(p => p.id === r.id);
    if (p) { Object.assign(p, { name: r.name, category: r.category, stock: r.stock, cost: r.cost }); updated++; }
    else { s.products.push({ id: r.id, name: r.name, category: r.category, stock: r.stock, cost: r.cost, price: r.price, reserved: 0, threshold: 10, commission: 12, packaging: 20, shipping: 45, other: 10 }); added++; }
  });
  const history = s.imports.find(i => i.name === name && i.status !== 'Tamamlandı');
  if (history) Object.assign(history, { added, updated, errors: 0, status: 'Tamamlandı', at: now() });
  else s.imports.unshift({ id: id(s, 'IMP'), name, added, updated, errors: 0, status: 'Tamamlandı', at: now() });
  s.tasks.filter(t => t.source === `import:${name}` && t.status !== 'Tamamlandı').forEach(t => { t.status = 'Tamamlandı'; });
  log(s, 'Ürün aktarımı tamamlandı', `${name} · ${added} yeni, ${updated} güncellenen ürün`); scanStock(s);
}
export function addFecraValidationExamples(s: Data) {
  const examples = [
    { name: 'fecra-urun-stok-maliyet-2026-10.xlsx', invalid: [{ Stok: -1 }] },
    { name: 'fecra-urun-maliyet-kontrol-2026-10.csv', invalid: [{ 'Alış Maliyeti': -20 }, { Stok: 1.5 }] },
  ];
  const role = s.role; s.role = 'Operasyon';
  examples.forEach(example => {
    if (s.imports.some(i => i.name === example.name) || s.tasks.some(t => t.source === `import:${example.name}`)) return;
    const rows = example.invalid.map((invalid, i) => ({ 'Ürün Kodu': s.products[i].id, 'Ürün Adı': s.products[i].name, Kategori: s.products[i].category, Stok: s.products[i].stock, 'Alış Maliyeti': s.products[i].cost, 'Satış Fiyatı': s.products[i].price, ...invalid }));
    recordImportErrors(s, example.name, validateRows(rows, s.products).filter(r => r.errors.length > 0).length);
  });
  s.role = role;
}
export function seed(): Data {
  const names = ['Scala 12 Parça Kahve Fincan Takımı', 'Ritim 12 Parça Kahve Fincan Takımı', 'Mytha 12 Parça Kahve Fincan Takımı', 'Zuri 6 Parça Pasta Tabağı Seti', 'Vendome 12 Parça Kahve Fincan Takımı'];
  const products = names.map((name, i): Product => ({ id: `FCR-${1001 + i}`, name: `Fecra ${name}`, category: i === 3 ? 'Pasta & Sunum' : 'Kahve & Çay', stock: [148, 72, 8, 46, 12][i], reserved: 0, cost: [580, 520, 610, 390, 450][i], price: [1190, 1090, 1290, 790, 990][i], commission: 12, packaging: 20, shipping: 45, other: 10, threshold: 15 }));
  const s: Data = { products, orders: [], requests: [], tasks: [], events: [], notifications: [], imports: [], role: 'Satış', sequence: 2000 };
  for (let i = 0; i < 28; i++) {
    const p = products[i % 5], quantity = i % 4 + 1, day = 8 - Math.floor(i / 4);
    const status: OrderStatus = i === 0 || i === 3 ? 'Onaylandı' : i === 1 ? 'Taslak' : i === 7 ? 'İptal' : 'Sevk Edildi';
    const o: Order = { id: `SIP-${1048 - i}`, customer: ['Elif Demir', 'Mert Yılmaz', 'Selin Kaya', 'Atölye 34', 'Deniz Aydın', 'İpek Arslan'][i % 6], channel: channels[i % 3], status, createdAt: `2026-10-${String(day).padStart(2, '0')}T${String(9 + i % 4).padStart(2, '0')}:15:00+03:00`, lines: [{ productId: p.id, name: p.name, quantity, price: p.price, contribution: calculate(p.price, p).contribution }] };
    s.orders.push(o); if (status === 'Onaylandı') { p.reserved += quantity; task(s, `${o.id} siparişini hazırla ve sevk et`, `order:${o.id}`); }
  }
  requestPrice(s, products[0].id, 890, products[0], 25, 'Hafta sonu kampanyası için fiyat önerisi.');
  requestPrice(s, products[4].id, 650, products[4], 25, 'Manuel satış kanalı için toplu alım fiyatı.');
  addFecraValidationExamples(s);
  scanStock(s); log(s, 'Demo çalışma alanı hazır', 'Ürünler, siparişler ve operasyon senaryoları yüklendi.');
  s.events.forEach((e,i) => { e.at = `2026-10-08T06:${String(55-i).padStart(2,'0')}:00Z`; });
  s.tasks.forEach(t => { t.createdAt = '2026-10-08T06:40:00Z'; });
  s.notifications.forEach(n => { n.at = '2026-10-08T06:45:00Z'; });
  s.requests.forEach(r => {
    r.createdAt = s.events.find(e => e.rule === 'price' && e.detail.includes(r.id))?.at ?? '2026-10-08T06:42:00Z';
    s.tasks.filter(t => t.source === `price:${r.id}`).forEach(t => { t.createdAt = r.createdAt; });
    s.notifications.filter(n => n.title.startsWith(r.id)).forEach(n => { n.at = r.createdAt; });
  });
  s.imports.forEach(i => {
    i.at = s.events.find(e => e.rule === 'import' && e.detail.startsWith(i.name))?.at ?? '2026-10-08T06:43:00Z';
    s.tasks.filter(t => t.source === `import:${i.name}`).forEach(t => { t.createdAt = i.at; });
    s.notifications.filter(n => n.title.startsWith(i.name)).forEach(n => { n.at = i.at; });
  });
  s.tasks.filter(t => t.source.startsWith('stock:')).forEach(t => { t.createdAt = s.events.find(e => e.rule === 'stock' && e.detail.startsWith(t.source.slice(6)))?.at ?? t.createdAt; });
  s.tasks.filter(t => t.source.startsWith('order:')).forEach(t => { t.createdAt = s.orders.find(o => o.id === t.source.slice(6))?.createdAt ?? t.createdAt; });
  return s;
}
