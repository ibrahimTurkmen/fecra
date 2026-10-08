# FECRA Operations

FECRA için hazırlanmış, Türkçe ve masaüstü odaklı çalışan operasyon demosu. React + TypeScript + Vite + Tailwind CSS + Zustand persist + React Router + Lucide + Recharts kullanır. Backend, gerçek kullanıcı girişi, veritabanı ve harici servis bağlantısı yoktur.

## Çalıştırma

```sh
npm install
npm run dev
```

Yerel adres: http://127.0.0.1:5173. Üretim derlemesi: `npm run build`. Derlenmiş sürüm: `npm run preview`. Kaynak klasörü `fecra-operations` içindedir.

## Demo senaryosu

1. Üst menüden **Operasyon** rolüne geçin. Ürünler → **Excel / CSV aktar** ekranında örnek CSV veya XLSX dosyasını indirin.
2. Ritim (`FCR-1002`) için stoku **85**, alış maliyetini **530** yapın. Dosyayı yükleyin, önizlemeyi kontrol edip onaylayın. Mevcut ürünlerin aktif satış fiyatı aktarımda korunur.
3. **Satış** rolüne geçin. Fiyatlandırma ekranında Ritim'i seçin; yeni fiyatı **790** girin. %12 komisyon ve 75 TL diğer giderlerle yaklaşık **%11,4** marj oluşur. Talebi yönetici onayına gönderin.
4. **Yönetici** rolüne geçin. Onay Merkezi'nden talebi açıklama ile onaylayın. Ritim'in aktif fiyatı **790 TL** olur.
5. Yeni siparişte müşteri adı girin, Ritim'den **3 adet** seçin. Taslak oluşturun, onaylayın: rezervasyon **3**, kullanılabilir stok **82** olur.
6. **Sevk edildi** seçin. Fiziksel stok **82**, rezervasyon **0** olur. Çift sevkiyat engellenir. Siparişteki fiyat ve katkı anlık görüntüsü sonraki fiyat/maliyet değişikliklerinden etkilenmez.
7. Genel Bakış, Raporlar, Görevler ve Bildirimler'deki değişiklikleri inceleyin. Raporları CSV veya Excel olarak indirin.
8. **Demo Verilerini Sıfırla** başlangıç senaryosunu geri yükler. Sıfırlama için uygulama içinde onay ekranı vardır.

## İş kuralları ve sınırlar

- Tüm operasyon verileri **DEMO VERİSİDİR**. Ürün adları [FECRA'nın ürün kataloğundan](https://www.fecra.com/) alınmıştır; fiyat, maliyet, kanal, sipariş, müşteri adı ve şirket politikaları örnektir. Gerçek FECRA ERP/muhasebe altyapısı hakkında varsayım yapılmamıştır.
- Tek Zustand deposu ve `localStorage` kullanılır. İşlemler kopya üzerinde doğrulanıp tek güncellemeyle uygulanır. Rol seçimi güvenlik veya kimlik doğrulama değildir; demo davranışını gösterir. Veriler yalnızca kullanılan tarayıcı profilinde saklanır; çok kullanıcılı/sunucu taraflı eşzamanlılık amaçlanmaz.
- Deterministik başlangıç ve raporlama günü **8 Ekim 2026**'dır. Yeni işlemler demo günü ve işlem anının saatiyle kaydedilir. Günlük satış, oluşturulma tarihi demo günü olan onaylı/sevk edilmiş siparişlerin toplamıdır. Ortalama katkı marjı satış tutarıyla ağırlıklıdır. Grafik son 7 veya 3 demo gününü gösterir.
- Tüm fiyat ve maliyetler KDV hariçtir. Komisyon satış fiyatının yüzdesidir. Marj ≥ %20 doğrudan uygulanır; altındaki değerler yönetici onayı gerektirir. Bekleyen talebin alış maliyeti değişirse onay engellenir ve güncel senaryo gerekir.
- Taslak stok ayırmaz. Onayda güncel kullanılabilir stok kontrol edilip rezervasyon yapılır. Sevkiyatta fiziksel stok ve rezervasyon birlikte düşer. İptalde rezervasyon çözülür. Sevk edilmiş sipariş iptal edilemez.
- Dosya sınırı 5 MB / 5.000 satırdır. CSV'de virgül/noktalı virgül ayracı, tırnaklı değerler, UTF-8 BOM ve ondalık virgül desteklenir. XLSX'in ilk sayfası okunur; formüller hesaplanmaz. `.xls` desteklenmez. Başlıklar örnek dosyadaki gibi olmalıdır. Bir hatalı satır tüm aktarımı engeller. Onayda güncel rezervasyonlar tekrar doğrulanır. Yeni üründe pozitif satış fiyatı zorunludur.
- Görevler stok eşiği, sipariş onayı/sevkiyatı ve dosya hatasıyla tetiklenir. Düşük stok görevi açıkken yinelenmez; stok düzelince tamamlanır. Fiyat kararları ilgili ekip bildirimlerini oluşturur.
- Desktop-only tasarım; 1440×900 önceliklidir. Mobil yerleşim geliştirilmemiştir.

## Entegrasyonlar

Gerçek çalışan bağlantı **yerel CSV/XLSX dosya okuma ve dışa aktarma**dır. Web Sipariş Kaynağı, ERP/Muhasebe, Microsoft İş Akışları ve Harici REST API yalnızca **Entegrasyon Taslağı** olarak gösterilir. SQL rapor sorgusu teknik öneridir, çalıştırılmaz. Power Automate / SharePoint / Power Apps önerileri gerçek Microsoft bağlantısı anlamına gelmez.

Destekleyen tarayıcılarda salt okunur `get_fecra_operations_summary` WebMCP aracı aynı state'ten özet verir. Standart arayüz buna bağımlı değildir. Bu ortamda yerel WebMCP desteği olmadığı için gerçek tarayıcı WebMCP doğrulaması yapılamadı.

## Test

```sh
npm test
npm run build
```

Vitest kritik fiyat, rol, rezervasyon, sevkiyat, iptal, fiyat geçmişi, aktarım doğrulama, otomasyon, dashboard ve deterministik sıfırlama senaryolarını kapsar.

Yerel Vite sunucusu çalışırken gerçek tarayıcı/Excel testi:

```sh
npx playwright install chromium
node scripts/browser-check.mjs
```

Gerekirse `PLAYWRIGHT_CHROMIUM_EXECUTABLE` ile mevcut Chromium yolunu, `DEMO_URL` ile test sunucusunu belirtin. Tarayıcı testi ayrı ve geçici bir profil kullanır; kullanıcının kayıtlarını değiştirmez. Sonuçlar ve ekran görüntüsü `test-results/` klasörüne yazılır.
