export function uploadType(category){
 const types={z:'Z raporu',income:'Satış faturası',expense:'Fiş',purchase:'Alış faturası',sales:'Satış faturası',receipt:'Gider fişi'};
 if(!Object.hasOwn(types,category))throw Error('Belge türünü seç: alış faturası, satış faturası, gider fişi veya Z raporu.');
 return types[category];
}
