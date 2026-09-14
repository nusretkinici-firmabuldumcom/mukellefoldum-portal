import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
async function passwordHash(password,salt=randomBytes(16).toString('hex')){return {salt,hash:(await scrypt(password,salt,64)).toString('hex')};}
async function matches(password,record){const hash=await passwordHash(password,record.salt);return timingSafeEqual(Buffer.from(hash.hash,'hex'),Buffer.from(record.hash,'hex'));}
const safeUser=user=>({id:user.id,username:user.username,firmId:user.firmId,enabled:user.enabled,applicantName:user.applicantName});
export async function portalStore(root,loadFirms,admin={}){
 const path=join(root,'data','portal.json');let queue=Promise.resolve();const sessions=new Map(),attempts=new Map();
 async function read(){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return {users:[],publications:[]};throw e;}}
 function mutate(fn){const op=queue.then(async()=>{const data=await read();const value=await fn(data);await mkdir(join(root,'data'),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(data,null,2));await rename(path+'.tmp',path);return value;});queue=op.catch(()=>{});return op;}
 if(!admin.username||!admin.password){await mutate(async data=>{if(data.advisor)return;const password=randomBytes(18).toString('base64url');data.advisor={username:'muhasebe',...await passwordHash(password)};await mkdir(join(root,'.deploy-secrets'),{recursive:true});await writeFile(join(root,'.deploy-secrets','kolaymukellef-yonetici.txt'),'Kullanıcı: muhasebe\nŞifre: '+password+'\nGiriş: /giris\n',{flag:'wx'});});}
 function invalidate(userId){for(const [token,s] of sessions)if(s.userId===userId)sessions.delete(token);}
 return {async login(username,password,ip){
  username=String(username||'').trim().toLowerCase();password=String(password||'');if(password.length>256||username.length>100)throw Error('Giriş bilgileri geçersiz.');
  const key=ip;const now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);const rate=attempts.get(key)||{count:0,until:now+900000};if(rate.count>=15)throw Error('Çok fazla deneme. 15 dakika sonra tekrar dene.');rate.count++;attempts.set(key,rate);
  const data=await read();let identity;
  if(admin.username&&admin.password){const expected=Buffer.from(admin.password),supplied=Buffer.from(password);if(username===admin.username.toLowerCase()&&expected.length===supplied.length&&timingSafeEqual(expected,supplied))identity={role:'advisor'};}
  else if(username===data.advisor?.username&&await matches(password,data.advisor))identity={role:'advisor'};
  if(!identity){const user=data.users.find(u=>u.username===username&&u.enabled);if(user&&await matches(password,user)&&((!user.firmId&&user.applicantName)||(await loadFirms()).some(f=>f.id===user.firmId)))identity={role:'taxpayer',firmId:user.firmId,userId:user.id,applicantName:user.applicantName};}
  if(!identity)throw Error('Kullanıcı adı veya şifre hatalı.');attempts.delete(key);const token=randomBytes(32).toString('hex');sessions.set(token,{...identity,expires:now+8*3600000});return {token,...identity};
 },async session(token){const s=sessions.get(token);if(!s||s.expires<Date.now()){sessions.delete(token);return null;}if(s.role==='taxpayer'){const user=(await read()).users.find(u=>u.id===s.userId&&u.enabled);if(!user||(user.firmId?!(await loadFirms()).some(f=>f.id===user.firmId):!user.applicantName))return null;s.firmId=user.firmId;s.applicantName=user.applicantName;}return s;},logout:token=>sessions.delete(token),
 allUsers:async()=>(await read()).users.map(safeUser),
 users:async firmId=>(await read()).users.filter(u=>u.firmId===firmId).map(safeUser),
 createUser:input=>mutate(async data=>{const username=String(input.username||'').trim().toLowerCase(),password=String(input.password||'');if(!/^[a-z0-9._@-]{3,100}$/.test(username))throw Error('Kullanıcı adı 3–100 karakter olmalı (harf, rakam, . _ @ -).');if(password.length<12||password.length>128)throw Error('Şifre 12–128 karakter olmalı.');if(input.firmId?!(await loadFirms()).some(f=>f.id===input.firmId):!String(input.applicantName||'').trim())throw Error('Firma veya başvuran adı gerekli.');if(data.users.some(u=>u.username===username)||username===(admin.username||data.advisor?.username||'muhasebe').toLowerCase())throw Error('Bu kullanıcı adı kullanılıyor.');const user={id:randomUUID(),firmId:input.firmId||null,applicantName:String(input.applicantName||'').trim().slice(0,200),username,enabled:true,...await passwordHash(password)};data.users.push(user);return safeUser(user);}),
 changeUser:input=>mutate(async data=>{const user=data.users.find(u=>u.id===input.userId&&u.firmId===input.firmId);if(!user)throw Error('Kullanıcı bulunamadı.');if(input.action==='reset'){const password=String(input.password||'');if(password.length<12||password.length>128)throw Error('Şifre 12–128 karakter olmalı.');Object.assign(user,await passwordHash(password));}else if(input.action==='link'){if(!(await loadFirms()).some(f=>f.id===input.targetFirmId))throw Error('Firma bulunamadı.');user.firmId=input.targetFirmId;}else if(input.action==='disable')user.enabled=false;else if(input.action==='enable')user.enabled=true;else throw Error('Geçersiz işlem.');invalidate(user.id);return safeUser(user);}),
 publish:(firmId,period,title,bytes)=>mutate(async data=>{if(!(await loadFirms()).some(f=>f.id===firmId)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error('Firma/dönem geçersiz.');if(bytes.subarray(0,5).toString()!=='%PDF-'||bytes.length>20*1024*1024)throw Error('En fazla 20 MB PDF yükle.');title=String(title||'').trim().slice(0,200);if(!title)throw Error('Belge başlığı gerekli.');const id=randomUUID();const doc={id,firmId,period,title,publishedAt:new Date().toISOString()};await mkdir(join(root,'data','published'),{recursive:true});await writeFile(join(root,'data','published',id+'.pdf'),bytes);data.publications.push(doc);return doc;}),
 publications:async firmId=>(await read()).publications.filter(d=>d.firmId===firmId),
 unpublish:(firmId,id)=>mutate(data=>{const index=data.publications.findIndex(d=>d.firmId===firmId&&d.id===id);if(index<0)throw Error('Belge bulunamadı.');data.publications.splice(index,1);}),
 async publicationFile(firmId,id){const doc=(await read()).publications.find(d=>d.id===id&&d.firmId===firmId);if(!doc)throw Error('Belge bulunamadı.');return {doc,bytes:await readFile(join(root,'data','published',doc.id+'.pdf'))};}
 };
}
