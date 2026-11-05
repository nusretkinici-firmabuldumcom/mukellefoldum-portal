const $=s=>document.querySelector(s);const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,options){const response=await fetch(path,options);if(response.status===401){location.assign('/giris?role=taxpayer');throw Error('Oturum sona erdi.');}const data=await response.json();if(!response.ok)throw Error(data.error);return data;}
const now=new Date();$('#period').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
async function documents(){if(!$('#period').value)return;const data=await api('/api/client/documents?period='+encodeURIComponent($('#period').value));$('#documents').innerHTML=data.documents.length?data.documents.map(d=>`<li><div class="file-name"><strong>${escapeHTML(d.name)}</strong><small>${escapeHTML(d.type||'Belge')} · ${escapeHTML(d.status)}</small></div><a href="/api/client/file?period=${encodeURIComponent($('#period').value)}&id=${encodeURIComponent(d.id)}">İndir</a></li>`).join(''):'<li class="empty">Bu dönemde henüz belge yok.</li>';}
async function declarations(){const data=await api('/api/client/declarations');$('#declarations').innerHTML=data.declarations.length?data.declarations.map(d=>`<li><div><strong>${escapeHTML(d.title)}</strong><small>${escapeHTML(d.period)} · Paylaşım: ${escapeHTML(new Date(d.publishedAt).toLocaleDateString('tr-TR'))}</small></div><a href="/api/client/declaration?id=${encodeURIComponent(d.id)}">PDF indir</a></li>`).join(''):'<li class="empty">Mali müşavirin henüz beyanname paylaşmadı.</li>';}
async function account(){const data=await api('/api/client/account'),sum=data.invoices.reduce((total,i)=>total+Math.round(Number(i.balance)*100),0);$('#account-balance').textContent=new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(sum/100);$('#account-invoices').innerHTML=data.invoices.length?data.invoices.map(i=>`<li class="account-invoice"><div><strong>${escapeHTML(i.title)}</strong><small>${escapeHTML(i.period)} · Fatura: ${new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(i.amount))} · Ödenen: ${new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(i.paidAmount))}</small><small>Kalan borç: <b>${new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(i.balance))}</b>${i.payments.length?` · Son ödeme: ${escapeHTML(new Date(i.payments.at(-1).at).toLocaleDateString('tr-TR'))}`:''}</small></div><a href="/api/client/account-invoice?id=${encodeURIComponent(i.id)}" data-file-title="${escapeHTML(i.title)}">Faturayı görüntüle</a></li>`).join(''):'<li class="empty">Henüz cari fatura bulunmuyor.</li>';}
let uploading=false;
async function upload(files,category='expense'){if(uploading)return;if(!$('#period').value){$('#error').textContent='Önce belge dönemini seç.';return;}uploading=true;const period=$('#period').value;$('#choose').disabled=$('#photo').disabled=$('#period').disabled=true;$('#error').textContent='';const results=[];try{for(const file of files){if(file.size>20*1024*1024){results.push(file.name+': 20 MB sınırını aşıyor.');continue;}$('#upload-status').textContent=file.name+' yükleniyor…';try{const result=await api('/api/client/upload?period='+encodeURIComponent(period)+'&name='+encodeURIComponent(file.name)+'&category='+encodeURIComponent(category),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});results.push(file.name+(result.duplicate?': Daha önce yüklenmiş.':': Mali müşavirinin arşivine eklendi.'));}catch(e){results.push(file.name+': '+e.message);}}await documents();}catch(e){$('#error').textContent=e.message;}finally{$('#upload-status').textContent=results.join('\n');uploading=false;$('#choose').disabled=$('#photo').disabled=$('#period').disabled=false;}}
$('#choose').onclick=()=>$('#files').click();$('#photo').onclick=()=>$('#camera').click();for(const id of ['#files','#camera'])$(id).onchange=e=>{upload([...e.target.files]);e.target.value='';};$('#drop').ondragover=e=>{e.preventDefault();$('#drop').classList.add('drag');};$('#drop').ondragleave=()=>$('#drop').classList.remove('drag');$('#drop').ondrop=e=>{e.preventDefault();$('#drop').classList.remove('drag');upload([...e.dataTransfer.files]);};$('#period').onchange=()=>documents().catch(e=>$('#error').textContent=e.message);
function showView(view){for(const id of ['documents','declarations'])$('#'+id+'-view').hidden=id!==view;}
$('#documents-tab').onclick=()=>showView('documents');$('#declarations-tab').onclick=()=>{showView('declarations');declarations().catch(e=>$('#error').textContent=e.message);};$('#logout').onclick=async()=>{await api('/api/auth/logout',{method:'POST'});location.assign('/giris?role=taxpayer');};
api('/api/portal/me').then(async data=>{if(data.role!=='taxpayer'){location.assign('/');return;}$('#firm-name').textContent=data.firm.name;$('#firm-tax').textContent=data.applicant?'İşyeri açılış başvurusu':'VKN / TCKN: '+data.firm.taxId;if(!data.applicant)await documents();}).catch(e=>$('#error').textContent=e.message);
// Belge önizleme: uygulama içinde açılır. Dosya adresine gidilirse (özellikle ana ekrana
// eklenmiş uygulamada) geri dönüş olmadığı için kullanıcı uygulamayı kapatmak zorunda kalıyordu.
(function belgeOnizleme(){
 if(document.getElementById('belge-onizleme'))return;
 const katman=document.createElement('div');
 katman.id='belge-onizleme';katman.hidden=true;
 katman.innerHTML='<div class="onizleme-ic"><div class="onizleme-ust"><strong id="onizleme-ad"></strong><div><a id="onizleme-indir" download>İndir</a><button type="button" id="onizleme-kapat" aria-label="Kapat">Kapat</button></div></div><div class="onizleme-govde" id="onizleme-govde"></div></div>';
 document.body.append(katman);
 const kapat=()=>{katman.hidden=true;document.getElementById('onizleme-govde').replaceChildren();document.body.style.overflow='';};
 katman.querySelector('#onizleme-kapat').onclick=kapat;
 katman.onclick=e=>{if(e.target===katman)kapat();};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!katman.hidden)kapat();});
 document.addEventListener('click',e=>{
  const bag=e.target.closest('a[href*="/api/client/file"],a[href*="/api/client/account-invoice"]');
  if(!bag)return;
  e.preventDefault();
  const adres=new URL(bag.getAttribute('href'),location.origin);
  const ad=bag.dataset.fileTitle||bag.closest('.document')?.querySelector('strong')?.textContent||'Belge';
  adres.searchParams.set('inline','1');
  const govde=document.getElementById('onizleme-govde');govde.replaceChildren();
  const uzanti=ad.split('.').pop().toLowerCase();
  const oge=document.createElement(['jpg','jpeg','png','webp','heic'].includes(uzanti)?'img':'iframe');
  oge.src=adres.pathname+adres.search;oge.alt=ad;oge.title=ad;
  govde.append(oge);
  document.getElementById('onizleme-ad').textContent=ad;
  const indir=document.getElementById('onizleme-indir');
  indir.href=bag.getAttribute('href');indir.setAttribute('download',ad);
  katman.hidden=false;document.body.style.overflow='hidden';
 });
})();
