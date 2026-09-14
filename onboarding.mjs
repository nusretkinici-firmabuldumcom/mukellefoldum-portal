export function validateOnboarding(input) {
  if (!['company', 'sole'].includes(input.firmType)) throw Error('Şirket veya şahıs işletmesi seç.');
  const text = key => String(input[key] || '').trim().slice(0, 200);
  return {firmType: input.firmType, ismmmoContractNumber: text('ismmmoContractNumber'), digitalContractNumber: text('digitalContractNumber'), defterApplicationNumber: text('defterApplicationNumber'), lucaAccountCode: text('lucaAccountCode')};
}

// Draft references never constitute external evidence. Only a future trusted
// adapter may establish portal completion; no client-supplied status is used.
export function onboardingSteps(firm = {}) {
  if (!['company', 'sole'].includes(firm.firmType)) return [{id:'onboarding-type', title:'Firma türünü seç: şirket / şahıs işletmesi', status:'blocked', reason:'Firma başlangıç ayarlarında tür belirtilmeli.', dependsOn:[]}];
  if (firm.firmType === 'company') return [];
  const definitions = [
    ['review', 'Vergi levhası, firma bilgileri ve başlangıç evraklarını doğrula'],
    ['ismmmo', 'İSMMMO üzerinden sözleşme oluştur ve sözleşme numarasını doğrula'],
    ['digital', 'İSMMMO sözleşme numarasıyla Dijital Vergi Dairesi muhasebeci ekranında sözleşme oluştur'],
    ['application', 'Defter-Beyan uygunluğunu doğrula ve başvuru yap'],
    ['visibility', 'Firmanın Defter-Beyan ekranında göründüğünü kontrol et'],
    ['luca-account', 'Doğrulanan firma için LUCA’da cari aç ve cari kodunu doğrula']
  ];
  if(firm.edefter?.enabled==='yes')definitions.splice(3,2,['regime','e-Defter seçimiyle defter tutma esasını doğrula; Defter-Beyan başvurusunu otomatik başlatma']);
  return definitions.map(([id,title],index) => ({id:'onboarding-'+id, title, status:index?'waiting':'blocked', dependsOn:index?['onboarding-'+definitions[index-1][0]]:[], reason:index?'Önceki adımın aynı firma için doğrulanmış sonucu gerekli.':'Başlangıç belgeleri ve canlı portal bağlantıları doğrulanmalı.'}));
}

export function applyOnboarding(run, firm) {
  const prerequisites = onboardingSteps(firm);
  const steps = run.steps.filter(step => !step.id.startsWith('onboarding-'));
  if (steps.length && prerequisites.length) steps[0] = {...steps[0], status:'waiting', dependsOn:[prerequisites.at(-1).id], reason:'Firma başlangıç işlemlerinin tamamlanması bekleniyor.'};
  else if (steps[0]?.dependsOn?.some(id=>id.startsWith('onboarding-'))) steps[0] = {...steps[0], status:'blocked', dependsOn:[], reason:'LUCA bağlantısı ve firma eşleştirmesi gerekli.'};
  run.steps = [...prerequisites, ...steps];
  return run;
}
