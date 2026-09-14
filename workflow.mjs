import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {applyOnboarding} from './onboarding.mjs';
export function previousPeriod(date=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const get=k=>Number(parts.find(p=>p.type===k).value);let year=get('year'),month=get('month')-1;if(!month){month=12;year--;}return {period:`${year}-${String(month).padStart(2,'0')}`,year,month,day:get('day')};}
export function createRun(firmId,profile,period){const month=Number(period.slice(5));const steps=[];const add=(id,title,reason='LUCA bağlantısı ve firma eşleştirmesi gerekli.')=>steps.push({id,title,status:steps.length?'waiting':'blocked',reason});
  add('firm','Firma, dönem ve hesap planını doğrula');
  add('firm-email','Firma e-posta adresini LUCA firma kartıyla eşleştir ve aktarımı doğrula');
  if(profile.hasSgk==='yes')add('payroll','Çalışan ve aylık bordro / prim bilgilerini kontrol et');
  if(profile.landlords.length)add('rent','Mal sahibi, kira ödemesi ve stopaj bilgilerini kontrol et');
  if(profile.invoiceSources.includes('efatura'))add('efatura','e-Fatura alış ve satış belgelerini çek, mükerrerleri ayır ve işle');
  if(profile.invoiceSources.includes('earsiv'))add('earsiv','e-Arşiv alış ve satış belgelerini çek, mükerrerleri ayır ve işle');
  add('uploads','Dönemin yüklenen Z raporu, alış fişi ve faturalarını kontrol edip işle');
  add('reconcile','Belge bütünlüğü, borç/alacak, KDV ve dönem mutabakatı');
  if(profile.declarations.includes('kdv1'))add('kdv1','KDV1 taslağını hazırla');
  if(profile.declarations.includes('kdv2'))add('kdv2','KDV2 yükümlülüğünü doğrula ve taslağı hazırla');
  if(profile.withholding==='monthly'||profile.withholding==='quarterly'&&[3,6,9,12].includes(month))add('withholding',profile.withholding==='monthly'?'Aylık muhtasar vergi kesintilerini hazırla':'Kapanan çeyreğin muhtasar vergi kesintilerini hazırla');
  if(profile.hasSgk==='yes')add('sgk','Aylık SGK prim/hizmet bölümünü hazırla; muhtasarla birleştirme tercihini doğrula');
  for(const d of profile.otherDeclarations||[])add('other-'+steps.length,`${d}: ilgili dönem ve yükümlülüğü doğrula; uygunsa taslak hazırla`);
  add('review','Taslakları, tutarları ve belge sürümlerini incelemeye hazırla');
  add('telegram','Telegram’a firma/dönem ve taslak sürümüne bağlı onay isteği gönder','Telegram bağlantısı ve yetkili kullanıcı/chat eşleştirmesi gerekli.');
  add('approval','Kullanıcının bu taslak sürümüne ait açık onayını bekle','Henüz hazırlanmış ve onaylanmış beyanname yok.');
  add('submit','Onaylanan beyannameleri LUCA üzerinden uygun GİB kanalına gönder; kabul/tahakkuku doğrula','LUCA/GİB bağlantısı ve geçerli taslak onayı gerekli.');
  add('whatsapp','Başarılı kabul sonrası müşteriye WhatsApp bilgilendirmesi gönder','WhatsApp Business bağlantısı, doğrulanmış alıcı ve mesaj şablonu gerekli.');
  return {id:crypto.randomUUID(),firmId,period,createdAt:new Date().toISOString(),status:'blocked',steps,notice:'Bu kayıt iş planıdır; belgeler işlenmedi, beyanname hazırlanmadı veya gönderilmedi.'};
}
export function validateProfile(input){const text=(v,max=200)=>String(v||'').trim().slice(0,max);const p={hasSgk:input.hasSgk,sgkWorkplace:text(input.sgkWorkplace,40),withholding:input.withholding,invoiceSources:(input.invoiceSources||[]).filter(x=>['efatura','earsiv'].includes(x)),declarations:(input.declarations||[]).filter(x=>['kdv1','kdv2'].includes(x)),otherDeclarations:(input.otherDeclarations||[]).map(x=>text(x,100)).filter(Boolean).slice(0,20),employees:[],landlords:[],whatsapp:text(input.whatsapp,25),lucaFirmCode:text(input.lucaFirmCode,100),enabled:input.enabled===true,updatedAt:new Date().toISOString()};
  if(!['yes','no','unknown'].includes(p.hasSgk)||!['monthly','quarterly','none','unknown'].includes(p.withholding))throw Error('SGK ve muhtasar dönemini seç.');
  if(!Array.isArray(input.employees)||!Array.isArray(input.landlords)||input.employees.length>500||input.landlords.length>50)throw Error('Çalışan veya mal sahibi listesi geçersiz.');
  p.employees=input.employees.map(e=>({name:text(e.name),identity:text(e.identity,11),job:text(e.job,20),start:text(e.start,10),end:text(e.end,10),gross:text(e.gross,20),notes:text(e.notes,1000)}));
  p.landlords=input.landlords.map(e=>({name:text(e.name),identity:text(e.identity,11),address:text(e.address,1000),rent:text(e.rent,20),basis:['gross','net'].includes(e.basis)?e.basis:'gross',rate:text(e.rate,10),start:text(e.start,10),end:text(e.end,10)}));
  for(const e of [...p.employees,...p.landlords])if(!e.name||!/^\d{10,11}$/.test(e.identity))throw Error('Çalışan/mal sahibi adı ve 10–11 rakamlı kimlik bilgisi gerekli.');
  if(p.hasSgk==='no'&&p.employees.length)throw Error('SGK yok seçiliyken çalışan kaydı eklenemez.');
  if(p.enabled&&(p.hasSgk==='unknown'||p.withholding==='unknown'))throw Error('Görevi etkinleştirmeden SGK ve muhtasar yükümlülüğünü belirle.');
  if(p.enabled&&p.hasSgk==='yes'&&(!p.sgkWorkplace||!p.employees.length))throw Error('SGK işyeri sicilini ve çalışanları ekle.');return p;
}
export function workflowStore(root,loadFirms){let queue=Promise.resolve();const path=join(root,'data','workflow.json');async function read(){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return {profiles:{},runs:[]};throw e;}}function mutate(fn){const work=queue.then(async()=>{const data=await read();const result=await fn(data);await mkdir(join(root,'data'),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(data,null,2));await rename(path+'.tmp',path);return result;});queue=work.catch(()=>{});return work;}
  async function makeRun(firmId,period){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error('Geçerli dönem seç.');const firm=(await loadFirms()).find(f=>f.id===firmId);if(!firm)throw Error('Önce gerçek bir firma kartı ekle.');return mutate(data=>{const profile=data.profiles[firmId];if(!profile)throw Error('Önce firma görev ayarlarını kaydet.');let run=data.runs.find(r=>r.firmId===firmId&&r.period===period);if(!run){run=createRun(firmId,profile,period);data.runs.push(run);}applyOnboarding(run,firm);return run;});}
  return {read,refreshOnboarding:async(id)=>{const firm=(await loadFirms()).find(f=>f.id===id);return mutate(data=>{for(const run of data.runs.filter(r=>r.firmId===id&&r.status!=='complete')){applyOnboarding(run,firm);delete run.manifest;run.revision=(run.revision||0)+1;}});},saveProfile:async(id,input)=>{const firm=(await loadFirms()).find(f=>f.id===id);if(!firm)throw Error('Önce gerçek bir firma kartı ekle.');const profile=validateProfile(input);return mutate(data=>{data.profiles[id]=profile;for(const run of data.runs.filter(r=>r.firmId===id&&r.status!=='complete')){const wasPaused=run.status==='paused';run.steps=applyOnboarding(createRun(id,profile,run.period),firm).steps;run.status=wasPaused?'paused':'blocked';delete run.manifest;run.revision=(run.revision||0)+1;}return profile;});},makeRun,
    prepare:async(id,period,manifest)=>{const run=await makeRun(id,period);return mutate(data=>{const current=data.runs.find(r=>r.id===run.id);if(current.status==='paused')throw Error('Önce görevi devam ettir.');current.manifest=manifest;current.revision=(current.revision||0)+1;current.preparedAt=new Date().toISOString();current.notice='Yerel hazırlık kontrolü yapıldı. Muhasebe kaydı ve beyanname gönderimi yapılmadı.';return current;});},
    control:(runId,action)=>mutate(data=>{const run=data.runs.find(r=>r.id===runId);if(!run)throw Error('Görev bulunamadı.');if(!['pause','resume'].includes(action))throw Error('Geçersiz işlem.');run.status=action==='pause'?'paused':'blocked';run.updatedAt=new Date().toISOString();return run;}),
    tick:async()=>{const p=previousPeriod();if(p.day<10)return;const data=await read();for(const [id,profile] of Object.entries(data.profiles))if(profile.enabled){try{await makeRun(id,p.period);}catch{ /* A stale firm must not prevent other firms from being scheduled. */ }}}};
}
