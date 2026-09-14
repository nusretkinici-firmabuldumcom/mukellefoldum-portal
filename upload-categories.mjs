export function uploadType(category){
 const types={z:'Z raporu',income:'Satış faturası',expense:'Fiş'};
 if(!Object.hasOwn(types,category))throw Error('Z raporu, gelir faturası veya gider fişleri kategorisini seç.');
 return types[category];
}
