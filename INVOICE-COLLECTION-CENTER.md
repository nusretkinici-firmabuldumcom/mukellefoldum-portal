# Fatura Toplama Merkezi — kurtarma dalı

Bu dal, eski MükellefOldum kaynak kodunun kurtarılabilen sunucu tarafı sürümü üzerinde hazırlanmıştır. Üretim servisine bağlı değildir.

## İlk aşama: SMMM ekranı ve belge kabul API'si

- Danışman oturumu ile açılan `/fatura-merkezi` ekranı eklendi.
- Firmaya bağlanmış mükellef oturumu ile açılan `/mukellef/fatura-yukle` ekranı eklendi; mükellef yalnızca kendi firma arşivine belge gönderir.
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


## GİB bağlantısı için resmî yol ve sınırlar

Resmî kılavuzların gösterdiği ayrım:

- **e-Fatura doğrudan entegrasyon:** GİB teknik kılavuzlarına uyum, başvuru/test ve Başkanlık onayı gerektiren bir entegrasyon yöntemidir. e-Fatura sistemi 7/24 alım-gönderim esasına göre çalışır. Bu, sıradan bir kullanıcı adı/şifre otomasyonu değildir.
- **Özel entegratör:** GİB'den izinli özel entegratör, hizmet verdiği mükelleflerin faturalarını alıp iletebilir. Mükellef yetkilendirmesi, gizlilik ve veri güvenliği yükümlülükleri vardır. MükellefOldum için ilk otomatik gelen e-Fatura bağlantısında bu yol tercih edilmelidir.
- **e-Arşiv Portal:** GİB'in resmî portal giriş sayfası mali mühür/sertifika tabanlı giriş tarif ediyor. İncelenen resmî kaynaklarda üçüncü tarafların kullanabileceği genel amaçlı, açık bir toplu e-Arşiv gelen-fatura API'si doğrulanamadı. Bu nedenle portal ekranına robotla giriş veya GİB parolası saklama yapılmayacak; yazılı GİB teyidi ya da yetkili entegratör servisi olmadan otomatik çekim vaadi verilmeyecek.
- **İlk sürüm:** Mükellefin kendi yüklediği PDF/XML, e-posta eki ve özel entegratörün yetkili API'si tek arşivde birleştirilecek. Her kaynak ve belge kimliği audit kaydında tutulacak.

Resmî dayanaklar:
- [GİB e-Fatura Uygulaması Entegrasyon Kılavuzu](https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/e-FaturaUygulamasiEntegrasyonKilavuzu-v1.9.pdf)
- [GİB e-Fatura Özel Entegrasyon Kılavuzu](https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/e-Fatura_Uygulamasi_Ozel_Entegrasyon_Kilavuzu_v1.12.pdf)
- [GİB'in e-Fatura entegrasyon ve özel entegratör mevzuatı açıklaması](https://gib.gov.tr/mevzuat/kanun/434/teblig/8014)
- [GİB e-Arşiv Portal giriş ekranı](https://earsivportal.efatura.gov.tr/)

## Doğrulama durumu

- API ve iki ekran kurtarma dalına yazıldı; canlı ortamda çalıştırma, otomatik test ve güvenlik testi henüz yapılmadı.

Kaynak ağacının tamamı kurtarılamadığı için bu dal henüz derlenmiş/test edilmiş kabul edilmemelidir. Özellikle eski ZIP içindeki `dist/` arayüz dosyaları Git geçmişinde ayrı dosyalar olarak bulunmuyor; yalnızca ZIP arşivi mevcut. Bu nedenle mevcut canlı arayüze entegre edilmeden önce arayüz dosyaları kurtarılmalı ve tam test/build çalıştırılmalıdır.
