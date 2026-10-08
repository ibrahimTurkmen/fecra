import { chromium } from '@playwright/test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import writeXlsx from 'write-excel-file/node';
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const base=process.env.DEMO_URL??'http://127.0.0.1:5173';
await fs.mkdir('test-results',{recursive:true});
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fecra-operations-v1')).state);
const go=async route=>{await page.goto(base+route);await page.locator('h1').waitFor();};
try{
  await go('/');await page.getByLabel('Aktif rol',{exact:true}).selectOption('Operasyon');
  const cleanSeed = await state();
  await page.evaluate(()=>{
    const stored=JSON.parse(localStorage.getItem('fecra-operations-v1'));
    stored.version=1;
    for(const [index,name] of ['eski-proje-verileri.xlsx','eski-calisma-listesi.csv'].entries()){
      stored.state.tasks.push({id:`TSK-OLD-${index}`,title:`${name}: ${index+1} hatalı satırı kontrol et`,source:`import:${name}`,team:'Operasyon',priority:'Normal',status:'Bekliyor',createdAt:'2026-10-08T07:00:00Z'});
      stored.state.events.push({id:`EVT-OLD-${index}`,title:'Aktarım doğrulama hatası',detail:`${name} · ${index+1} hatalı satır`,rule:'import',role:'Operasyon',at:'2026-10-08T07:00:00Z'});
      stored.state.notifications.push({id:`NTF-OLD-${index}`,title:`${name}: veri kontrol görevi oluşturuldu`,team:'Operasyon',read:false,at:'2026-10-08T07:00:00Z'});
    }
    localStorage.setItem('fecra-operations-v1',JSON.stringify(stored));
  });
  await page.reload();await page.locator('h1').waitFor();
  assert(!JSON.stringify(await state()).includes('eski-proje-verileri'));
  assert(!JSON.stringify(await state()).includes('eski-calisma-listesi'));
  assert.deepEqual((await state()).products,cleanSeed.products);
  console.log('PASS: eski kalıcı dosya kayıtları ve bağlı aktiviteler temizlendi; ürün verileri korundu.');
  await page.screenshot({path:'test-results/dashboard.png',fullPage:true});
  for(const width of [1366,1440,1920]){
    await page.setViewportSize({width,height:900});
    for(const route of ['/','/urunler','/fiyatlandirma','/onaylar','/siparisler','/gorevler','/raporlar']){
    await go(route);assert(await page.locator('h1').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Yatay taşma: ${width} ${route}`);
    const clipped=await page.locator('.panel table').evaluateAll(tables=>tables.filter(table=>table.getBoundingClientRect().right>table.parentElement.getBoundingClientRect().right+2).map(table=>table.textContent.slice(0,60)));
    assert.deepEqual(clipped,[],`Kesilen tablo: ${width} ${route}`);
    const text=await page.locator('main').innerText();assert(!/\bNaN\b|\bundefined\b/.test(text),`Geçersiz değer: ${route}`);
    for(const amount of text.match(/-?₺[\d.,]+/g)??[])assert(/^-?₺\d{1,3}(?:\.\d{3})*,\d{2}$/.test(amount),`Para formatı: ${amount}`);
    assert.equal(await page.getByRole('button',{name:/Siteyi düzenle/i}).count(),0);
    }
  }
  await page.setViewportSize({width:1440,height:900});
  console.log('PASS: 7 ekran × 1366/1440/1920px; tablolar, para formatları ve geçersiz değer kontrolü.');
  await go('/');await page.locator('.priority-item').first().click();
  await page.getByRole('dialog',{name:'Fiyat talebini incele'}).waitFor();
  assert(await page.getByRole('button',{name:'Fiyatı onayla'}).isDisabled());await page.keyboard.press('Escape');
  await go('/');await page.locator('.stock-item').first().click();
  const product=(await state()).products.find(p=>p.id===new URL(page.url()).searchParams.get('detail'));
  assert.equal(await page.getByLabel('Yeni fiziksel stok').inputValue(),String(product.stock));await page.keyboard.press('Escape');
  console.log('PASS: dashboard fiyat/stok bağlantıları doğru drawer açıyor; rol kısıtları korunuyor.');
  await go('/urunler?import=1');
  assert((await page.locator('[aria-current="step"]').innerText()).includes('Dosya seç'));
  for(const format of ['CSV','XLSX']){const pendingDownload=page.waitForEvent('download');await page.getByRole('button',{name:`Örnek ${format} indir`,exact:true}).click();const sample=await pendingDownload;assert(sample.suggestedFilename().startsWith('fecra-'));await sample.saveAs(`test-results/fecra-ornek.${format.toLowerCase()}`);}
  await page.getByLabel('Aktarım dosyası').setInputFiles({name:'fecra-validation.csv',mimeType:'text/csv',buffer:Buffer.from('Ürün Kodu;Ürün Adı;Kategori;Stok;Alış Maliyeti;Satış Fiyatı\nFCR-1002;Fecra Ritim 12 Parça Kahve Fincan Takımı;Kahve & Çay;-1;530;1090')});
  await page.locator('.import-summary').getByText('1 hatalı',{exact:false}).waitFor();assert(await page.getByRole('button',{name:'Aktarımı onayla (1 ürün)'}).isDisabled());
  assert((await page.locator('[aria-current="step"]').innerText()).includes('Kontrol et'));
  assert((await state()).tasks.some(t=>t.source==='import:fecra-validation.csv'));
  const headers=['Ürün Kodu','Ürün Adı','Kategori','Stok','Alış Maliyeti','Satış Fiyatı'];
  await writeXlsx([headers.map(value=>({value})),['FCR-1002','Fecra Ritim 12 Parça Kahve Fincan Takımı','Kahve & Çay',85,530,1].map(value=>({type:typeof value==='number'?Number:String,value}))],{filePath:path.resolve('test-results/fecra-maliyet.xlsx')});
  await page.getByLabel('Aktarım dosyası').setInputFiles('test-results/fecra-maliyet.xlsx');
  await page.locator('.import-summary').getByText('0 hatalı',{exact:false}).waitFor();await page.getByRole('button',{name:'Aktarımı onayla (1 ürün)'}).click();
  assert((await page.locator('[aria-current="step"]').innerText()).includes('Aktar'));
  assert(await page.getByRole('button',{name:'Aktarım tamamlandı',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Tamamla',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});let s=await state();assert.equal(s.products[1].stock,85);assert.equal(s.products[1].cost,530);assert.equal(s.products[1].price,1090);
  console.log('PASS: hatalı CSV engellendi, gerçek XLSX aktarıldı, aktif fiyat korundu.');
  await page.getByLabel('Aktif rol',{exact:true}).selectOption('Satış');await go('/fiyatlandirma?product=FCR-1002');
  await page.getByLabel('Yeni satış fiyatı',{exact:true}).fill('790');await page.getByRole('button',{name:'Yönetici onayına gönder'}).click();
  s=await state();assert.equal(s.products[1].price,1090);const requestId=s.requests[0].id;
  await page.getByLabel('Aktif rol',{exact:true}).selectOption('Yönetici');await go('/onaylar');
  await page.locator('tr').filter({hasText:requestId}).getByRole('button',{name:'İncele'}).click();
  await page.getByLabel('Karar açıklaması (isteğe bağlı)').fill('Sunum için kampanya onayı.');await page.getByRole('button',{name:'Fiyatı onayla'}).click();
  s=await state();assert.equal(s.products[1].price,790);
  console.log('PASS: fiyat talebi onay öncesi uygulanmadı, yönetici onayı fiyatı değiştirdi.');
  await go('/siparisler?new=1');await page.getByLabel('Müşteri adı').fill('Demo Sunum Müşterisi');
  await page.getByLabel('Ürün 1',{exact:true}).selectOption('FCR-1002');await page.getByLabel('Ürün 1 adedi',{exact:true}).fill('3');
  await page.getByRole('button',{name:'Taslak sipariş oluştur'}).click();await page.getByRole('button',{name:'Onayla ve stok ayır'}).waitFor();
  s=await state();assert.equal(s.orders[0].lines[0].price,790);assert.equal(s.products[1].reserved,0);
  await page.getByRole('button',{name:'Onayla ve stok ayır'}).click();s=await state();assert.equal(s.products[1].reserved,3);
  await page.getByRole('button',{name:'Sevk edildi',exact:true}).click();s=await state();assert.equal(s.products[1].reserved,0);assert.equal(s.products[1].stock,82);assert.equal(s.orders[0].status,'Sevk Edildi');
  await page.reload();await page.locator('h1').waitFor();assert.equal((await state()).products[1].stock,82);
  console.log('PASS: sipariş → rezervasyon → sevkiyat → kalıcı kayıt.');
  await go('/raporlar');const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Excel',exact:true}).click();const download=await downloadPromise;assert(download.suggestedFilename().endsWith('.xlsx'));await download.saveAs('test-results/rapor.xlsx');
  await page.getByRole('button',{name:'Entegrasyon taslakları',exact:true}).click();await page.getByText('SQL tabanlı veri yönetimi yaklaşımı').waitFor();
  console.log('PASS: gerçek Excel raporu indirildi; entegrasyon taslakları görüntülendi.');
  await page.getByRole('button',{name:'Demo Verilerini Sıfırla',exact:true}).click();await page.getByRole('button',{name:'Sıfırla ve yeniden başlat'}).click();s=await state();assert.equal(s.products[1].stock,72);assert.equal(s.products[1].price,1090);assert.deepEqual(s.imports,cleanSeed.imports);
  await go('/');await page.screenshot({path:'test-results/dashboard.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: reset başlangıç verisini geri getirdi; tarayıcı çalışma zamanı hatası yok.');
}finally{await browser.close();}
