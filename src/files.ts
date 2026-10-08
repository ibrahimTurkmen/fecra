import Papa from 'papaparse';
import type { Product } from './domain';
export const headers = ['Ürün Kodu', 'Ürün Adı', 'Kategori', 'Stok', 'Alış Maliyeti', 'Satış Fiyatı'];
export async function readFile(file: File): Promise<Record<string, unknown>[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Dosya en fazla 5 MB olabilir.');
  if (/\.xlsx$/i.test(file.name)) {
    const readXlsxFile = (await import('read-excel-file')).default;
    const rows = await readXlsxFile(file); if (!rows.length) throw new Error('Dosya boş.');
    const titles = rows[0].map(c => String(c ?? '').trim()); checkHeaders(titles);
    if (rows.length > 5001) throw new Error('Tek aktarımda en fazla 5.000 satır desteklenir.');
    return rows.slice(1).filter(r => r.some(c => c !== null)).map(r => Object.fromEntries(titles.map((title, i) => [title, r[i]])));
  }
  if (!/\.csv$/i.test(file.name)) throw new Error('CSV veya XLSX dosyası seçin.');
  const result = Papa.parse<Record<string, unknown>>((await file.text()).replace(/^\uFEFF/, ''), { header:true, skipEmptyLines:'greedy', transformHeader: h => h.trim() });
  if (result.errors.length) throw new Error(`CSV okunamadı: ${result.errors[0].message}`);
  checkHeaders(result.meta.fields ?? []); if (result.data.length > 5000) throw new Error('Tek aktarımda en fazla 5.000 satır desteklenir.');
  return result.data;
}
function checkHeaders(titles: string[]) { const missing = headers.slice(0, 5).filter(h => !titles.includes(h)); if (missing.length) throw new Error(`Eksik sütunlar: ${missing.join(', ')}. Örnek dosyayı kullanın.`); if (new Set(titles).size !== titles.length) throw new Error('Yinelenen sütun adı var.'); }
function safeCell(v: unknown) { return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; }
export function csvDownload(name: string, rows: Record<string, unknown>[]) {
  const content = '\uFEFF' + Papa.unparse(rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)]))), { delimiter: ';' });
  const url = URL.createObjectURL(new Blob([content], { type:'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function xlsxDownload(name: string, rows: Record<string, unknown>[]) {
  const write = (await import('write-excel-file')).default;
  if (!rows.length) throw new Error('Dışa aktarılacak kayıt yok.'); const keys = Object.keys(rows[0]);
  await write([keys.map(k => ({ value:k, fontWeight:'bold' as const })), ...rows.map(r => keys.map(k => typeof r[k] === 'number' ? { type:Number, value:r[k] as number } : { type:String, value:String(r[k] ?? '') }))], { fileName:name, columns:keys.map(() => ({ width:24 })) });
}
export const productRows = (products: Product[]) => products.map(p => ({ 'Ürün Kodu':p.id, 'Ürün Adı':p.name, Kategori:p.category, Stok:p.stock, 'Alış Maliyeti':p.cost, 'Satış Fiyatı':p.price }));
