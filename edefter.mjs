import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {previousPeriod} from './workflow.mjs';
const periodPattern=/^\d{4}-(0[1-9]|1[0-2])$/;
export function validateEdefter(input){
 if(!['yes','no','unknown'].includes(input.enabled))throw Error('e-Defter için Evet veya Hayır seç.');
 const firstPeriod=String(input.firstPeriod||'');
 if(firstPeriod&&!periodPattern.test(firstPeriod))throw Error('İlk e-Defter dönemini ay/yıl olarak seç.');
 if(input.enabled==='yes'&&!firstPeriod)throw Error('Takip edilecek ilk e-Defter dönemini seç.');
 const frequency=input.frequency||'unknown';if(!['monthly','quarterly','unknown'].includes(frequency))throw Error('Yükleme tercihi geçersiz.');
 return {enabled:input.enabled,firstPeriod,frequency,edition:'desktop',updatedAt:new Date().toISOString()};
}
export function edefterSteps(){
 const items=[
 ['identity','LUCA masaüstünde firma, VKN/TCKN ve hesap dönemini doğrula'],
 ['deadline','Firmanın aylık/üç aylık yükleme tercihini, güncel GİB süresini ve uzatmaları doğrula'],
 ['prior','İlgili ayın önceki dönem ve parça durumlarını sorgula; mükerrer gönderimi engelle'],
 ['records','Muhasebe kayıtlarını, borç/alacak eşitliğini, belge türü/tarih/numaralarını ve yevmiye sırasını kontrol et'],
 ['generate','LUCA e-Defter dosyalarını ve ilgili beratları oluştur; gerekli defter türlerini doğrula'],
 ['validate','LUCA hata raporu, şema/şematron ve dosya bütünlüğü kontrollerini tamamla'],
 ['sign','Mali mühür/e-imza geçerliliğini kontrol et; LUCA imzalama ve doğrulamasını tamamla'],
 ['submit','Aynı firma/döneme ait doğrulanmış dosyaları LUCA üzerinden GİB’e gönder'],
 ['receipt','GİB işlem sonucunu sorgula; bekleyen veya hatalı paketi başarılı sayma'],
 ['download','GİB onaylı beratları indir; firma/dönem/parça eşleşmesini doğrula'],
 ['archive','Defterleri, imzalı dosyaları, onaylı beratları ve gönderim kanıtlarını arşivle; saklama aktarımını doğrula'],
 ['notify','Doğrulanmış sonuç ve arşiv bilgisiyle kullanıcıyı bilgilendir']
 ];
 return items.map(([id,title],i)=>({id,title,status:i?'waiting':'blocked',dependsOn:i?[items[i-1][0]]:[],reason:i?'Önceki adımın doğrulanmış sonucu bekleniyor.':'Windows LUCA masaüstü bağlantısı henüz kurulmadı.'}));
}
export function edefterStore(root,loadFirms){
 const path=join(root,'data','edefter.json');let queue=Promise.resolve();
 async function read(){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return {runs:[]};throw e;}}
 function mutate(fn){const op=queue.then(async()=>{const data=await read();const result=await fn(data);await mkdir(join(root,'data'),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(data,null,2));await rename(path+'.tmp',path);return result;});queue=op.catch(()=>{});return op;}
 async function makeRun(firmId,period){return mutate(async data=>{
  const firm=(await loadFirms()).find(f=>f.id===firmId);if(!firm)throw Error('Firma bulunamadı.');
  if(firm.edefter?.enabled!=='yes')throw Error('Önce bu firma için e-Defter Evet seç.');
  if(!periodPattern.test(period)||!firm.edefter.firstPeriod||period<firm.edefter.firstPeriod)throw Error('Dönem, e-Defter başlangıcından önce olamaz.');
  let run=data.runs.find(r=>r.firmId===firmId&&r.period===period);if(run)return run;
  run={id:randomUUID(),firmId,period,status:'blocked',createdAt:new Date().toISOString(),steps:edefterSteps(),canSubmit:false,notice:'Gönderim planı oluşturuldu. Defter oluşturulmadı, imzalanmadı veya gönderilmedi.',issues:['Windows LUCA masaüstü ajanı bağlı değil.','Güncel GİB son gönderim tarihi ve firma yükleme tercihi doğrulanmalı.','Mali mühür/e-imza ve LUCA yetkileri doğrulanmalı.'],settingsUpdatedAt:firm.edefter.updatedAt};
  data.runs.push(run);return run;
 });}
 return {read,makeRun,refresh:firm=>mutate(data=>{for(const run of data.runs.filter(r=>r.firmId===firm.id&&r.status!=='complete')){run.status=firm.edefter?.enabled==='yes'&&run.period>=firm.edefter.firstPeriod?'blocked':'disabled';run.settingsUpdatedAt=firm.edefter?.updatedAt;run.canSubmit=false;}}),
 tick:async()=>{const end=previousPeriod().period;for(const firm of await loadFirms()){if(firm.edefter?.enabled!=='yes'||!periodPattern.test(firm.edefter.firstPeriod||''))continue;let period=firm.edefter.firstPeriod;let count=0;while(period<=end&&count++<120){await makeRun(firm.id,period);let [year,month]=period.split('-').map(Number);if(++month===13){year++;month=1;}period=`${year}-${String(month).padStart(2,'0')}`;}}}
 };
}
