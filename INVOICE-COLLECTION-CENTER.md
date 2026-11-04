# Fatura Toplama Merkezi — kurtarma dalı

Bu dal, eski MükellefOldum kaynak kodunun kurtarılabilen sunucu tarafı sürümü üzerinde hazırlanmıştır. Üretim servisine bağlı değildir.

## İlk aşama: SMMM ekranı ve belge kabul API'si

- Danışman oturumu ile açılan `/fatura-merkezi` ekranı eklendi.
- Firma ve dönem seçimi, çoklu dosya yükleme, kategori seçimi, belge listesi ve indirme bağlantısı eklendi.

## Belge kabul API'si

Tüm uç noktalar mevcut danışman oturumu / advisor yetkisi gerektirir. Firma kimliği istek gövdesinden alınsa da işlem öncesinde kayıtlı firma listesinde doğrulanır. Dönem biçimi ve firma kapsamı mevcut `agentStore` tarafından doğrulanır.

- `GET /api/advisor/invoices?firmId=<id>&period=YYYY-MM`
  - Firmanın seçilen dönemdeki belgelerini listeler.
- `POST /api/advisor/invoices/upload?firmId=<id>&period=YYYY-MM&name=<dosya-adı>&category=purchase|sales|expense|receipt|z`
  - PDF, JPG, PNG veya XML; en fazla 20 MB.
  - SHA-256 özetiyle aynı dosyanın tekrar yüklenmesi tespit edilir.
- `GET /api/advisor/invoices/file?firmId=<id>&period=YYYY-MM&id=<document-id>`
  - Arşivlenen belgeyi indirir.

## Belge kategorileri

- `purchase`: Alış faturası
- `sales` / `income`: Satış faturası
- `expense` / `receipt`: Gider fişi
- `z`: Z raporu

## Güvenlik ve kapsam

- Bu aşama yalnızca dosya kabulü, firma/dönem bazlı arşivleme ve mükerrer dosya kontrolüdür.
- GİB'e otomatik giriş, GİB şifresi saklama, e-posta kutusu okuma veya özel entegratör bağlantısı bu dalda uygulanmış değildir.
- GİB parolası istenmez veya saklanmaz.
- LUCA'ya otomatik fiş gönderimi yapılmaz. Muhasebe kaydı için veri çıkarımı, hesap önerisi ve SMMM onay kuyruğu sonraki aşamadır.
- Canlı Railway servisine bağlama veya deploy yapılmamıştır.

## Doğrulama durumu

Kaynak ağacının tamamı kurtarılamadığı için bu dal henüz derlenmiş/test edilmiş kabul edilmemelidir. Özellikle eski ZIP içindeki `dist/` arayüz dosyaları Git geçmişinde ayrı dosyalar olarak bulunmuyor; yalnızca ZIP arşivi mevcut. Bu nedenle mevcut canlı arayüze entegre edilmeden önce arayüz dosyaları kurtarılmalı ve tam test/build çalıştırılmalıdır.
