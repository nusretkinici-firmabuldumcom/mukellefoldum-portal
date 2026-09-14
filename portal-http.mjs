import {readFile} from 'node:fs/promises';
import {validBasicAuth} from './deployment-auth.mjs';
export function portalHttp({startup,portal,archive,firms,json,body,cloud,admin}){
 const publicFiles={'/tanitim':'landing.html','/landing.css':'landing.css','/landing.js':'landing.js','/startup-ui.js':'startup-ui.js','/startup-ui.css':'startup-ui.css','/advisor-startup.js':'advisor-startup.js','/giris':'login.html','/portal.css':'portal.css','/login.js':'login.js','/kolaymukellef':'taxpayer.html','/mukellefoldum':'taxpayer.html','/taxpayer.js':'taxpayer.js','/upload-categories.js':'upload-categories.js','/upload-categories.css':'upload-categories.css'};
 if(process.env.PUBLIC_LANDING_ROOT==='1')publicFiles['/']='landing.html';
 const cookie=token=>`luca_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token?28800:0}${cloud?'; Secure':''}`;
 function attachment(res,bytes,name){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);}
 return async(req,res,path)=>{
  const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('luca_session='))?.slice(13)||'';
  const url=new URL(req.url,'http://localhost'),q=url.searchParams;
  if(req.method==='GET'&&publicFiles[path]){const file=publicFiles[path];res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(new URL('./dist/'+file,import.meta.url)));return true;}
  if(path==='/api/auth/login'&&req.method==='POST'){try{const input=JSON.parse((await body(req,4096)).toString());const result=await portal.login(input.username,input.password,req.socket.remoteAddress);res.setHeader('Set-Cookie',cookie(result.token));json(res,200,{role:result.role});}catch(e){json(res,401,{error:e.message});}return true;}
  if(path==='/api/auth/logout'&&req.method==='POST'){portal.logout(token);res.setHeader('Set-Cookie',cookie(''));json(res,200,{ok:true});return true;}
  let identity=await portal.session(token);
  if(!identity&&validBasicAuth(req.headers.authorization,admin.username,admin.password))identity={role:'advisor'};
  if(!identity){if(path.startsWith('/api/'))json(res,401,{error:'Giriş yapman gerekiyor.'});else{res.writeHead(302,{Location:'/giris'});res.end();}return true;}
  if(path==='/api/portal/me'&&req.method==='GET'){if(identity.role==='advisor')json(res,200,{role:'advisor'});else{const firm=(await firms()).find(f=>f.id===identity.firmId);json(res,200,{role:'taxpayer',applicant:!firm,firm:{name:firm?.name||identity.applicantName,taxId:firm?.taxId||''}});}return true;}
  if(path.startsWith('/api/startup/')){
   try{
    const advisor=identity.role==='advisor';
    if(path==='/api/startup/list'&&advisor&&req.method==='GET'){json(res,200,{users:await portal.allUsers(),records:await startup.list()});return true;}
    const id=advisor?q.get('userId'):identity.userId;
    if(!id||!(await portal.allUsers()).some(u=>u.id===id))throw Error('Başvuran bulunamadı.');
    if(path==='/api/startup/record'&&req.method==='GET')json(res,200,await startup.get(id));
    else if(path==='/api/startup/record'&&req.method==='POST')json(res,200,await startup.update(id,JSON.parse((await body(req,16000)).toString()),advisor));
    else if(path==='/api/startup/upload'&&req.method==='POST'){const kind=q.get('kind');if((advisor&&kind!=='contract')||(!advisor&&kind!=='plate'))throw Error('Belge yükleme yetkisi yok.');json(res,201,await startup.upload(id,kind,await body(req,20*1024*1024)));}
    else if(path==='/api/startup/file'&&req.method==='GET'){const f=await startup.file(id,q.get('kind'));attachment(res,f.bytes,f.name);}
    else json(res,404,{error:'İşlem bulunamadı.'});
   }catch(e){json(res,400,{error:e.message});}return true;
  }
  if(path.startsWith('/api/client/')){
   if(identity.role!=='taxpayer'){json(res,403,{error:'Bu ekran mükellef hesabı içindir.'});return true;}
   if(!identity.firmId){json(res,403,{error:'Mali müşavirin firma kaydını bağladığında bu bölüm açılacak.'});return true;}
   const firmId=identity.firmId; // Never use a client-provided firm ID.
   try{
    if(path==='/api/client/documents'&&req.method==='GET'){const workspace=await archive.read(firmId,q.get('period'));json(res,200,{documents:workspace.docs.map(d=>({id:d.id,name:d.name,uploadedAt:d.uploadedAt,type:d.type,status:d.status==='ready'?'İncelendi':'İnceleme bekliyor'}))});}
    else if(path==='/api/client/upload'&&req.method==='POST'){const result=await archive.upload(firmId,q.get('period'),q.get('name'),await body(req,20*1024*1024),q.get('category')||'expense');json(res,201,{duplicate:result.result.duplicate,id:result.result.document.id});}
    else if(path==='/api/client/file'&&req.method==='GET'){const {doc,bytes}=await archive.file(firmId,q.get('period'),q.get('id'));attachment(res,bytes,doc.name);}
    else if(path==='/api/client/declarations'&&req.method==='GET')json(res,200,{declarations:await portal.publications(firmId)});
    else if(path==='/api/client/declaration'&&req.method==='GET'){const {doc,bytes}=await portal.publicationFile(firmId,q.get('id'));attachment(res,bytes,doc.title+'.pdf');}
    else json(res,404,{error:'İşlem bulunamadı.'});
   }catch(e){json(res,400,{error:e.message});}return true;
  }
  if(identity.role!=='advisor'){if(path==='/'){res.writeHead(302,{Location:'/mukellefoldum'});res.end();}else json(res,403,{error:'Bu alana erişim yetkin yok.'});return true;}
  if(path.startsWith('/api/advisor/')){
   try{
    if(path==='/api/advisor/users'&&req.method==='GET')json(res,200,{users:await portal.users(q.get('firmId'))});
    else if(path==='/api/advisor/users'&&req.method==='POST')json(res,201,{user:await portal.createUser(JSON.parse((await body(req,4096)).toString()))});
    else if(path==='/api/advisor/user'&&req.method==='POST')json(res,200,{user:await portal.changeUser(JSON.parse((await body(req,4096)).toString()))});
    else if(path==='/api/advisor/declarations'&&req.method==='GET')json(res,200,{declarations:await portal.publications(q.get('firmId'))});
    else if(path==='/api/advisor/publish'&&req.method==='POST')json(res,201,{declaration:await portal.publish(q.get('firmId'),q.get('period'),q.get('title'),await body(req,20*1024*1024))});
    else if(path==='/api/advisor/unpublish'&&req.method==='POST'){const input=JSON.parse((await body(req,4096)).toString());await portal.unpublish(input.firmId,input.id);json(res,200,{ok:true});}
    else json(res,404,{error:'İşlem bulunamadı.'});
   }catch(e){json(res,400,{error:e.message});}return true;
  }
  return false;
 };
}
