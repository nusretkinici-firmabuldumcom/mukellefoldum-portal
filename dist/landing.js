const menu=document.querySelector('.mobile-toggle'),nav=document.querySelector('#nav-links');
menu.onclick=()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);};
nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}});
const steps=[['✳','Her iş, bir fikirle başlar.','Şahıs işletmesi ya da şirket. Faaliyetini, işyeri adresini ve planladığın başlangıcı paylaş; ilk bilgilerini tek yerde hazırla.'],['◎','Birlikte doğru başlangıca.','Mali müşavirin bilgilerini incelesin. Kuruluş türüne ve faaliyet alanına uygun gereklilikleri, belgeleri ve işlem sırasını birlikte netleştirin.'],['↗','Sıradaki adımın belli olsun.','Resmî hizmeti ayrı pencerede aç, kendi hesabınla giriş yap ve başvurunu takip et. Başvuru referansını ve oluşan vergi levhanı hesabında paylaş.'],['▤','Artık gündeminde işin var.','Fiş ve faturalarını yükle; müşavirinin paylaştığı beyannamelere ve sözleşmelere ulaş. Düzenli belge paylaşımıyla aynı ekranda buluşun.']];
const tabs=[...document.querySelectorAll('[data-step]')],panel=document.querySelector('#journey-panel');
function selectStep(i){tabs.forEach((t,n)=>{t.setAttribute('aria-selected',String(n===i));t.tabIndex=n===i?0:-1;});panel.setAttribute('aria-labelledby',tabs[i].id);panel.querySelector('.panel-number').textContent=`0${i+1} / 04`;panel.querySelector('.panel-symbol').textContent=steps[i][0];panel.querySelector('h3').textContent=steps[i][1];panel.querySelector('p').textContent=steps[i][2];}
tabs.forEach((t,i)=>{t.onclick=()=>selectStep(i);t.onkeydown=e=>{let n;if(['ArrowRight','ArrowDown'].includes(e.key))n=(i+1)%tabs.length;else if(['ArrowLeft','ArrowUp'].includes(e.key))n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;if(n!==undefined){e.preventDefault();selectStep(n);tabs[n].focus();}};});
const dialog=document.querySelector('#start-dialog');let opener;
const descriptions={sole:['Şahıs işletmen için ilk adım.','Faaliyetini ve planladığın işyerini mali müşavirinle değerlendir. Açılış rehberi, bilgilerini hazırlamana ve süreci takip etmene yardımcı olur.'],company:['Şirketinin yolunu birlikte çizelim.','Şirket türünü, ortaklık yapısını ve kuruluş gerekliliklerini mali müşavirinle belirle. Resmî başvuru adımları şirketinin yapısına göre şekillenir.'],existing:['İşletmenin düzenini online taşı.','Mali müşavirin mevcut işletmeni hesabına bağlasın. Belgelerini paylaşmaya ve yayımlanan beyannamelerini takip etmeye başla.']};
document.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>{opener=b;const d=descriptions[b.dataset.start];document.querySelector('#start-title').textContent=d[0];document.querySelector('#start-description').textContent=d[1];dialog.showModal();});
document.querySelector('.close-dialog').onclick=()=>dialog.close();dialog.addEventListener('close',()=>opener?.focus());

// İşini anlat: yeni başvuru mesajı mali müşavirin mesaj kutusuna düşer.
const leadDialog=document.querySelector('#lead-dialog'),leadForm=document.querySelector('#lead-form'),leadStatus=document.querySelector('#lead-status');let leadOpener;
function openLead(type,from){leadOpener=from;leadForm.hidden=false;leadStatus.textContent='';leadStatus.className='';if(type)leadForm.businessType.value=type;if(dialog.open)dialog.close();leadDialog.showModal();setTimeout(()=>leadForm.text.focus(),50);}
document.querySelectorAll('[data-lead]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();openLead('',el);}));
document.querySelector('#step-tab-0').addEventListener('click',e=>openLead('',e.currentTarget));
let startType='';document.querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',()=>startType=b.dataset.start));
document.querySelector('[data-lead-from-start]').onclick=e=>openLead(startType,e.currentTarget);
leadDialog.querySelector('.close-dialog').onclick=()=>leadDialog.close();leadDialog.addEventListener('close',()=>leadOpener?.focus());
leadForm.onsubmit=async e=>{e.preventDefault();const btn=document.querySelector('#lead-submit');btn.disabled=true;leadStatus.className='';leadStatus.textContent='Gönderiliyor…';
 try{const r=await fetch('/api/public/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(leadForm)))});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Mesaj gönderilemedi. Lütfen tekrar dene.');
  leadForm.reset();leadStatus.className='ok';leadStatus.textContent='Mesajın mali müşavirine ulaştı. En kısa sürede e-posta ya da telefonla sana dönüş yapılacak.';}
 catch(err){leadStatus.className='err';leadStatus.textContent=err.message;}finally{btn.disabled=false;}};
