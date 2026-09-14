import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
export function startupStore(root){
 const dir=join(root,'data','startup'),path=join(dir,'records.json');let queue=Promise.resolve();
 const empty=userId=>({userId,revision:0,form:{businessType:'sole'},status:'draft',reference:'',feedback:''});
 async function read(){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
 function mutate(userId,fn){const op=queue.then(async()=>{const all=await read(),record=all[userId]||empty(userId);await fn(record);all[userId]=record;await mkdir(dir,{recursive:true});await writeFile(path+'.tmp',JSON.stringify(all));await rename(path+'.tmp',path);return record;});queue=op.catch(()=>{});return op;}
 return {get:async id=>(await read())[id]||empty(id),list:async()=>Object.values(await read()),
 update:(id,input,advisor=false)=>mutate(id,async r=>{
  if(input.revision!==r.revision)throw Error('Kayıt değişti. Yenileyip tekrar dene.');
  if(input.action==='save'&&!advisor){const f={};for(const key of ['businessType','name','activity','address','city','startDate','email'])f[key]=String(input.form?.[key]||'').trim().slice(0,1000);if(!['sole','company'].includes(f.businessType))throw Error('İşletme türünü seç.');r.form=f;r.status='draft';r.reference='';r.feedback='';}
  else if(input.action==='submit'&&!advisor){if(!r.form.name||!r.form.activity||!r.form.address)throw Error('Ad, faaliyet ve adres bilgilerini tamamla.');r.status='submitted';}
  else if(input.action==='review'&&advisor){if(r.status!=='submitted')throw Error('İncelemeye gönderilmiş başvuru gerekli.');r.status=input.approved===true?'reviewed':'changes_requested';r.feedback=String(input.feedback||'').slice(0,2000);}
  else if(input.action==='report'&&!advisor){if(!['reviewed','reported'].includes(r.status))throw Error('Önce mali müşavir incelemesi tamamlanmalı.');r.reference=String(input.reference||'').trim().slice(0,200);if(!r.reference)throw Error('Başvuru referansını gir.');r.status='reported';r.reportedAt=new Date().toISOString();}
  else if(input.action==='ack'&&!advisor){if(!r.contract||input.contractId!==r.contract.id)throw Error('Güncel sözleşmeyi açıp tekrar onayla.');r.acknowledged={contractId:r.contract.id,at:new Date().toISOString()};}
  else throw Error('Geçersiz işlem.');r.revision++;r.updatedAt=new Date().toISOString();
 }),
 upload:(id,kind,bytes)=>mutate(id,async r=>{if(!['plate','contract'].includes(kind))throw Error('Belge türü geçersiz.');const pdf=bytes.subarray(0,5).toString()==='%PDF-',png=bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a',jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!bytes.length||bytes.length>20*1024*1024||(!pdf&&!png&&!jpg)||(kind==='contract'&&!pdf))throw Error('Vergi levhası PDF/JPG/PNG, sözleşme PDF ve en fazla 20 MB olmalı.');const doc={id:randomUUID(),extension:pdf?'pdf':png?'png':'jpg',at:new Date().toISOString()};await mkdir(dir,{recursive:true});await writeFile(join(dir,doc.id),bytes);r[kind]=doc;if(kind==='contract')r.acknowledged=null;r.revision++;}),
 async file(id,kind){if(!['plate','contract'].includes(kind))throw Error('Belge türü geçersiz.');const r=(await read())[id],doc=r?.[kind];if(!doc)throw Error('Belge bulunamadı.');return {bytes:await readFile(join(dir,doc.id)),name:kind+'.'+doc.extension};}
 };
}
