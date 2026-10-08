import { describe,it,expect } from 'vitest';
import { readFile } from './files';
describe('Gerçek CSV ayrıştırma',()=>{
  it('BOM, noktalı virgül, tırnaklı ad ve Türkçe ondalık okur',async()=>{const file=new File(['\uFEFFÜrün Kodu;Ürün Adı;Kategori;Stok;Alış Maliyeti;Satış Fiyatı\nTEST;"Fincan; özel seri";Kahve;12;"530,50";990'],'test.csv');const rows=await readFile(file);expect(rows[0]['Ürün Adı']).toBe('Fincan; özel seri');expect(rows[0]['Alış Maliyeti']).toBe('530,50');});
  it('eksik başlıkları açık hata ile reddeder',async()=>{await expect(readFile(new File(['Kod;Stok\nX;3'],'test.csv'))).rejects.toThrow(/Eksik sütunlar/);});
  it('desteklenmeyen dosyayı reddeder',async()=>{await expect(readFile(new File(['abc'],'test.xls'))).rejects.toThrow(/CSV veya XLSX/);});
});
