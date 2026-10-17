import {robinhoodStatus} from '../services/robinhood-status.mjs';
let cached=null,pending=null;
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');res.statusCode=405;return res.end(JSON.stringify({error:'Read-only endpoint; use GET'}));}
 try{if(!cached||Date.now()-cached.time>30000){pending??=robinhoodStatus().then(data=>{cached={time:Date.now(),data};return data;}).finally(()=>pending=null);await pending;}
 res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=30');res.statusCode=200;return res.end(JSON.stringify(cached.data));
 }catch(e){res.setHeader('Cache-Control','no-store');res.statusCode=503;return res.end(JSON.stringify({error:e.message,mainnetVerified:false}));}
}
