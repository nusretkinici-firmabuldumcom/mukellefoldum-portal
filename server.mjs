import http from 'node:http';
import { readFile,writeFile,mkdir,mkdtemp,rm,rmdir,rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extractTaxFields } from './tax-fields.mjs';
import {validateOnboarding,onboardingSteps} from './onboarding.mjs';
import {workflowStore} from './workflow.mjs';
import {agentStore,prepareManifest} from './agent-store.mjs';
import {validBasicAuth} from './deployment-auth.mjs';
import {edefterStore,validateEdefter} from './edefter.mjs';
import {portalStore} from './portal-store.mjs';
import {startupStore} from './startup-store.mjs';
import {portalHttp} from './portal-http.mjs';
const execute=promisify(execFile),codeRoot=fileURLToPath(new URL('.',import.meta.url)),root=process.env.DATA_ROOT||codeRoot;
const cloud=process.env.DEPLOYMENT_MODE==='cloud',port=Number(process.env.PORT||4173);
if(cloud&&(!process.env.APP_USER||!process.env.APP_PASSWORD))throw Error('Cloud authentication must be configured.');
const files={'/ofis':'index.html','/':'index.html','/index.html':'index.html','/app.js':'app.js','/firms.js':'firms.js','/workflow-ui.js':'workflow-ui.js','/archive-ui.js':'archive-ui.js','/onboarding-ui.js':'onboarding-ui.js','/style.css':'style.css'};
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req,max){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw new Error('Dosya boyutu sınırı aşıldı.');chunks.push(chunk);}return Buffer.concat(chunks);}
async function firms(){try{return JSON.parse(await readFile(join(root,'data','firms.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
let busy=false,saveQueue=Promise.resolve();
const workflows=workflowStore(root,firms);
const archive=agentStore(root,firms);
const admin={username:process.env.APP_USER,password:process.env.APP_PASSWORD};
const portal=await portalStore(root,firms,admin);
const handlePortal=portalHttp({startup:startupStore(root),portal,archive,firms,json,body,cloud,admin});
files['/advisor-portal.js']='advisor-portal.js';
const edefters=edefterStore(root,firms);
files['/edefter-ui.js']='edefter-ui.js';
setInterval(()=>edefters.tick().catch(()=>console.error('e-Defter planlama kontrolü başarısız.')),60000).unref();
edefters.tick().catch(()=>console.error('e-Defter planlama kontrolü başarısız.'));
let preparationTickActive=false;
async function preparationTick(){if(preparationTickActive)return;preparationTickActive=true;try{await workflows.tick();const data=await workflows.read(),list=await firms();for(const run of data.runs){if(run.status==='paused'||!data.profiles[run.firmId]?.enabled)continue;const firm=list.find(f=>f.id===run.firmId);if(!firm)continue;try{const manifest=prepareManifest(firm,data.profiles[firm.id],await archive.read(firm.id,run.period),run.period);if(run.manifest?.hash!==manifest.hash)await workflows.prepare(firm.id,run.period,manifest);}catch{console.error('Bir firmanın hazırlık kontrolü tamamlanamadı.');}}}finally{preparationTickActive=false;}}
setInterval(()=>preparationTick().catch(()=>console.error('Aylık görev planı oluşturulamadı.')),60000).unref();
preparationTick().catch(()=>console.error('Aylık görev planı oluşturulamadı.'));
http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/health'&&req.method==='GET'){json(res,200,{status:'ok'});return;}
  const allowedHosts=[`127.0.0.1:${port}`,`localhost:${port}`,process.env.RAILWAY_PUBLIC_DOMAIN,process.env.APP_HOST].filter(Boolean);
  if(!allowedHosts.includes(req.headers.host)){json(res,403,{error:'Geçersiz adres.'});return;}
  try{
    if(path.startsWith('/api/')&&req.headers.origin){const origins=allowedHosts.flatMap(host=>host.startsWith('localhost:')||host.startsWith('127.0.0.1:')?['http://'+host]:['https://'+host]);if(!origins.includes(req.headers.origin)){json(res,403,{error:'İstek engellendi.'});return;}}
    if(await handlePortal(req,res,path))return;
    if(path.startsWith('/api/')){
      const allowedOrigins=allowedHosts.flatMap(host=>host.startsWith('localhost:')||host.startsWith('127.0.0.1:')?['http://'+host]:['https://'+host]);
      if(req.headers.origin&&!allowedOrigins.includes(req.headers.origin)){json(res,403,{error:'İstek engellendi.'});return;}
      if(path==='/api/firms'&&req.method==='GET'){json(res,200,{firms:await firms()});return;}
      if(path==='/api/firms/onboarding'&&req.method==='GET'){const id=new URL(req.url,'http://localhost').searchParams.get('firmId');const firm=(await firms()).find(f=>f.id===id);if(!firm){json(res,404,{error:'Firma bulunamadı.'});return;}json(res,200,{firm,steps:onboardingSteps(firm)});return;}
      if(path==='/api/workflow'&&req.method==='GET'){json(res,200,await workflows.read());return;}
      if(path==='/api/edefter'&&req.method==='GET'){const id=new URL(req.url,'http://localhost').searchParams.get('firmId');const firm=(await firms()).find(f=>f.id===id);if(!firm){json(res,404,{error:'Firma bulunamadı.'});return;}const data=await edefters.read();json(res,200,{settings:firm.edefter||{enabled:'unknown',frequency:'unknown',firstPeriod:'',edition:'desktop'},runs:data.runs.filter(r=>r.firmId===id)});return;}
      if(path==='/api/archive'&&req.method==='GET'){const q=new URL(req.url,'http://localhost').searchParams;json(res,200,await archive.read(q.get('firmId'),q.get('period')));return;}
      if(path==='/api/archive/file'&&req.method==='GET'){const q=new URL(req.url,'http://localhost').searchParams;const {doc,bytes}=await archive.file(q.get('firmId'),q.get('period'),q.get('id'));res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(bytes);return;}
      if(req.method!=='POST'){json(res,405,{error:'Desteklenmeyen işlem.'});return;}
      if(path==='/api/edefter/settings'||path==='/api/edefter/plan'){
        try{const input=JSON.parse((await body(req,4096)).toString('utf8'));if(path.endsWith('/plan')){json(res,200,{run:await edefters.makeRun(input.firmId,input.period)});return;}
        const settings=validateEdefter(input.settings||{});const save=saveQueue.then(async()=>{const list=await firms();const firm=list.find(f=>f.id===input.firmId);if(!firm)throw Error('Firma bulunamadı.');firm.edefter=settings;await writeFile(join(root,'data','firms.tmp'),JSON.stringify(list,null,2));await rename(join(root,'data','firms.tmp'),join(root,'data','firms.json'));return firm;});saveQueue=save.catch(()=>{});const firm=await save;await edefters.refresh(firm);await workflows.refreshOnboarding(firm.id);await edefters.tick();json(res,200,{firm});
        }catch(e){json(res,400,{error:e.message});}return;
      }
      if(path==='/api/archive/upload'||path==='/api/archive/save'){
        try{const q=new URL(req.url,'http://localhost').searchParams;const result=path.endsWith('/upload')?await archive.upload(q.get('firmId'),q.get('period'),q.get('name'),await body(req,20*1024*1024),q.get('category')||'expense'):await archive.save(q.get('firmId'),q.get('period'),JSON.parse((await body(req,3*1024*1024)).toString('utf8')));json(res,200,result);}catch(e){json(res,400,{error:e.message});}return;
      }
      if(path==='/api/workflow/prepare'||path==='/api/workflow/control'){
        try{const input=JSON.parse((await body(req,4096)).toString('utf8'));if(path.endsWith('/control')){json(res,200,{result:await workflows.control(input.runId,input.action)});return;}const firm=(await firms()).find(f=>f.id===input.firmId);if(!firm)throw Error('Firma bulunamadı.');const data=await workflows.read();const manifest=prepareManifest(firm,data.profiles[firm.id],await archive.read(firm.id,input.period),input.period);json(res,200,{result:await workflows.prepare(firm.id,input.period,manifest)});}catch(e){json(res,400,{error:e.message});}return;
      }
      if(path==='/api/firms/onboarding'){
        // General onboarding changes preserve the independently managed e-Defter settings.
        try { const input=JSON.parse((await body(req,4096)).toString('utf8'));const settings=validateOnboarding(input);
          const save=saveQueue.then(async()=>{const list=await firms();const firm=list.find(f=>f.id===input.firmId);if(!firm)throw Error('Firma bulunamadı.');Object.assign(firm,settings);firm.onboardingUpdatedAt=new Date().toISOString();await writeFile(join(root,'data','firms.tmp'),JSON.stringify(list,null,2));await rename(join(root,'data','firms.tmp'),join(root,'data','firms.json'));return firm;});saveQueue=save.catch(()=>{});const firm=await save;await workflows.refreshOnboarding(firm.id);json(res,200,{firm});
        } catch(e){json(res,400,{error:e.message});}return;
      }
      if(path==='/api/firms/email'){
        const input=JSON.parse((await body(req,4096)).toString('utf8'));const email=String(input.email||'').trim();
        if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){json(res,400,{error:'Geçerli bir firma e-posta adresi gir.'});return;}
        const save=saveQueue.then(async()=>{const list=await firms();const firm=list.find(f=>f.id===input.firmId);if(!firm){json(res,404,{error:'Firma bulunamadı.'});return;}firm.email=email;firm.emailLucaStatus='pending_connection';await writeFile(join(root,'data','firms.tmp'),JSON.stringify(list,null,2));await rename(join(root,'data','firms.tmp'),join(root,'data','firms.json'));json(res,200,{firm});});saveQueue=save.catch(()=>{});await save;return;
      }
      if(path==='/api/workflow/profile'||path==='/api/workflow/run'){
        try{const data=JSON.parse((await body(req,1024*1024)).toString('utf8'));const result=path.endsWith('/profile')?await workflows.saveProfile(data.firmId,data.profile):await workflows.makeRun(data.firmId,data.period);json(res,200,{result});}catch(e){json(res,400,{error:e.message});}return;
      }
      if(path==='/api/firms'){
        const f=JSON.parse((await body(req,2*1024*1024)).toString('utf8'));
        let settings;try{settings=validateOnboarding(f);}catch(e){json(res,400,{error:e.message});return;}
        for(const field of ['name','taxId','taxOffice','address'])if(typeof f[field]!=='string'||!f[field].trim()||f[field].length>1000){json(res,400,{error:'Unvan, vergi numarası, vergi dairesi ve adresi doldur.'});return;}
        if(!/^\d{10,11}$/.test(f.taxId)){json(res,400,{error:'Vergi numarası 10 veya 11 rakam olmalı.'});return;}
        const email=String(f.email||'').trim();if(email&&(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))){json(res,400,{error:'Geçerli bir firma e-posta adresi gir.'});return;}
        if(f.logo&&(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(f.logo)||f.logo.length>1500000)){json(res,400,{error:'Logo geçersiz veya çok büyük.'});return;}
        const save=saveQueue.then(async()=>{const list=await firms();if(list.some(x=>x.taxId===f.taxId))return json(res,409,{error:'Bu vergi numarasıyla firma zaten kayıtlı.'});const record={...settings,id:crypto.randomUUID(),name:f.name.trim(),taxId:f.taxId,taxOffice:f.taxOffice.trim(),address:f.address.trim(),activity:String(f.activity||'').slice(0,1000),startDate:String(f.startDate||'').slice(0,50),email,emailLucaStatus:email?'pending_connection':'not_provided',logo:f.logo||'',createdAt:new Date().toISOString()};list.push(record);await mkdir(join(root,'data'),{recursive:true});await writeFile(join(root,'data','firms.tmp'),JSON.stringify(list,null,2));await rename(join(root,'data','firms.tmp'),join(root,'data','firms.json'));json(res,201,{firm:record});});saveQueue=save.catch(()=>{});await save;return;
      }
      if(path==='/api/tax-read'){
        if(busy){json(res,429,{error:'Bir belge okunuyor. Biraz sonra yeniden dene.'});return;}
        const bytes=await body(req,20*1024*1024);const pdf=bytes.subarray(0,5).toString()==='%PDF-',png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpg=bytes[0]===255&&bytes[1]===216;
        if(!pdf&&!png&&!jpg){json(res,400,{error:'PDF, JPG veya PNG vergi levhası yükle.'});return;}
        if(busy){json(res,429,{error:'Bir belge okunuyor. Biraz sonra yeniden dene.'});return;}busy=true;let temp;
        try{temp=await mkdtemp(join(tmpdir(),'luca-tax-'));const source=join(temp,pdf?'plate.pdf':png?'plate.png':'plate.jpg');await writeFile(source,bytes);let imagePath=source;
          if(pdf){await execute(process.platform==='win32'?'pdftoppm.exe':'pdftoppm',['-f','1','-singlefile','-scale-to','2400','-png',source,join(temp,'page')],{timeout:45000,windowsHide:true});imagePath=join(temp,'page.png');}
          let recognized;
          if(process.platform==='win32'){const {stdout}=await execute('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(codeRoot,'scripts','read-tax-image.ps1'),'-ImagePath',imagePath],{timeout:60000,maxBuffer:1024*1024,windowsHide:true,encoding:'utf8'});recognized=JSON.parse(stdout.replace(/^\uFEFF/,'')).text;}
          else{const {stdout}=await execute('tesseract',[imagePath,'stdout','-l','tur+eng','--psm','6'],{timeout:60000,maxBuffer:1024*1024,encoding:'utf8'});recognized=stdout;}
          json(res,200,{text:recognized,fields:extractTaxFields(recognized),note:pdf?'PDF’nin ilk sayfası okundu. Tüm alanları kontrol et.':'Fotoğraf okundu. Tüm alanları kontrol et.'});
        }finally{busy=false;if(temp){for(const name of ['plate.pdf','plate.png','plate.jpg','page.png'])await rm(join(temp,name),{force:true});await rmdir(temp).catch(()=>{});}}return;
      }
      json(res,404,{error:'İşlem bulunamadı.'});return;
    }
    const file=files[path];if(!file){res.writeHead(404);res.end('Not found');return;}const content=await readFile(new URL('./dist/'+file,import.meta.url));res.writeHead(200,{'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(content);
  }catch(error){json(res,500,{error:path==='/api/tax-read'?'Belge okunamadı. Net bir JPG/PNG deneyebilir veya bilgileri elle girebilirsin.':'İşlem tamamlanamadı. Bilgileri kontrol edip yeniden dene.'});}
}).listen(port,cloud?'0.0.0.0':'127.0.0.1',()=>console.log('LUCA server ready on port '+port));
