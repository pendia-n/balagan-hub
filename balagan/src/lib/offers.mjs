export const offers=Object.freeze({
 'tokens-50':{name:'50 Balagan tokens',cents:500,tokens:50,group:'wallet'},
 'tokens-150':{name:'150 Balagan tokens',cents:700,tokens:150,group:'wallet'},
 'tokens-500':{name:'500 Balagan tokens',cents:1500,tokens:500,group:'wallet'},
 'wallet-monthly':{name:'Balagan 600 · monthly',cents:1200,tokens:600,interval:'month',count:1,group:'wallet'},
 'wallet-annual':{name:'Balagan 600 · annual',cents:13400,tokens:600,interval:'year',count:1,group:'wallet'},
 'wallet-two-year':{name:'Balagan 1500 · two years',cents:32600,tokens:1500,interval:'year',count:2,group:'wallet'},
});
// Retain terms for historical receipts and outstanding Stripe events.
const retiredOffers=Object.freeze({
 'thiskicks-monthly':{name:'Thiskicks monthly',cents:200,quota:10,interval:'month',count:1,group:'thiskicks'},
 'thiskicks-annual':{name:'Thiskicks annual',cents:2000,quota:15,interval:'year',count:1,group:'thiskicks'},
 'thiskicks-lifetime':{name:'Thiskicks lifetime',cents:6000,quota:50,group:'thiskicks'},
});
export const offerFor=id=>Object.hasOwn(offers,id)?offers[id]:Object.hasOwn(retiredOffers,id)?retiredOffers[id]:null;
export const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(cents/100);
