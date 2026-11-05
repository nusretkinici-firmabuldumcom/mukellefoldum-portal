(() => {
 const advisor=!!document.querySelector('#dropzone');
 const old=document.querySelector(advisor?'#dropzone':'#drop');
 if(!old)return;
 const css=document.createElement('link');css.rel='stylesheet';css.href='/upload-categories.css';document.head.append(css);
 old.hidden=true;
 const grid=document.createElement('div');grid.className='upload-categories';
 const categories=[['z','Z Raporları','Günlük kasa ve satış raporlarını ekle.','▤'],['expense','Gider Fişleri','Alış faturalarını ve gider fişlerini ekle.','↙'],['receipt','Makbuzlar','Serbest meslek, gider pusulası ve diğer makbuzları ekle.','✎'],['bank','Banka Hareketleri','Hesap ekstresi veya banka dökümünü (PDF, Excel, CSV) ekle.','₺']];
 for(const [category,title,description,icon] of categories){
  const panel=document.createElement('details');panel.className='upload-category';
  panel.innerHTML=`<summary><span class="category-icon">${icon}</span><strong>${title}</strong><span class="category-toggle" aria-hidden="true">＋</span></summary><div class="category-body"><p>${description}</p><div class="category-drop"><span>Dosyaları buraya sürükle</span><div class="category-actions"><button type="button" class="button" data-pick>Dosya seç</button><button type="button" class="button" data-camera>Fotoğraf çek</button></div></div><input type="file" data-files accept=".pdf,.jpg,.jpeg,.png,.heic,.xml,.xlsx,.xls,.csv" multiple hidden><input type="file" data-photo accept="image/jpeg,image/png" capture="environment" hidden><small>PDF, JPG, PNG, XML · En fazla 20 MB</small></div>`;
  const files=panel.querySelector('[data-files]'),photo=panel.querySelector('[data-photo]');
  panel.querySelector('[data-pick]').onclick=()=>files.click();
  files.onchange=()=>{upload([...files.files],category);files.value='';};
  photo.onchange=()=>{upload([...photo.files],category);photo.value='';};
  panel.querySelector('[data-camera]').onclick=()=>{if(advisor){receivePhoto=files=>upload(files,category);openCamera();}else photo.click();};
  panel.ondragover=e=>{e.preventDefault();panel.open=true;panel.classList.add('dragging');};
  panel.ondragleave=()=>panel.classList.remove('dragging');
  panel.ondrop=e=>{e.preventDefault();panel.classList.remove('dragging');upload([...e.dataTransfer.files],category);};
  grid.append(panel);
 }
 old.before(grid);
})();
