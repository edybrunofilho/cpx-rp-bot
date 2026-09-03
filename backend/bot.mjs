import {money} from '../lib/cpx/engine.mjs';
const API='https://discord.com/api/v10';
export class DiscordError extends Error{constructor(message,status,retryAfter=0){super(message);this.status=status;this.retryAfter=retryAfter;}}
export async function discord(path,token,options={}){
 const response=await fetch(API+path,{...options,headers:{Authorization:'Bot '+token,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(10000)});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new DiscordError('Discord indisponível ('+response.status+')',response.status,Math.ceil(Number(body.retry_after||response.headers.get('retry-after')||5)*1000));
 return body;
}
export function createNotifier(store,token,send=discord){
 let working=false,pausedUntil=0;
 async function tick(){
  if(working||Date.now()<pausedUntil)return;working=true;
  try{
   const job=store.db.prepare("SELECT * FROM outbox WHERE status='queued' AND next_attempt<=? ORDER BY rowid LIMIT 1").get(Date.now());if(!job)return;
   const player=store.get().players.find(p=>p.id===job.user_id);const p=JSON.parse(job.payload);
   if(!player||(!player.notifications&&!p.forced)){store.db.prepare("UPDATE outbox SET status='cancelled',error='Notificações desativadas pelo jogador' WHERE id=?").run(job.id);return;}
   try{
    const channel=await send('/users/@me/channels',token,{method:'POST',body:JSON.stringify({recipient_id:job.user_id})});
    await send('/channels/'+channel.id+'/messages',token,{method:'POST',body:JSON.stringify({nonce:job.id.replaceAll('-','').slice(0,25),enforce_nonce:true,allowed_mentions:{parse:[]},embeds:[{title:p.direction==='credit'?'Você recebeu dinheiro RP':'Movimentação de saída RP',description:'Uma movimentação foi registrada na sua conta CPX. Valores fictícios, exclusivos do roleplay.',color:p.direction==='credit'?0xe6c62a:0xb86a49,fields:[{name:'Valor RP',value:money(p.amount),inline:true},{name:'Saldo após a operação',value:money(p.balance),inline:true},{name:'Motivo',value:p.reason},{name:'Comprovante',value:p.txId}],footer:{text:'cpx guardian • Desative estes avisos no portal, em Conexão Discord.'},timestamp:p.at}]})});
    store.db.prepare("UPDATE outbox SET status='sent',attempts=attempts+1,error=NULL WHERE id=?").run(job.id);
   }catch(e){
    const attempts=job.attempts+1;const blocked=e.status===403||e.status===404;const permanent=blocked||(e.status>=400&&e.status<500&&e.status!==429);const failed=permanent||attempts>=8;
    const delay=e.status===429?Math.max(e.retryAfter,1000):Math.min(3600000,5000*2**attempts);
    if(e.status===429)pausedUntil=Date.now()+delay;
    store.db.prepare('UPDATE outbox SET status=?,attempts=?,next_attempt=?,error=? WHERE id=?').run(blocked?'blocked':failed?'failed':'queued',attempts,Date.now()+delay,blocked?'DM bloqueada ou usuário indisponível':e.status===429?'Limite temporário do Discord':'Falha temporária de envio',job.id);
   }
  }finally{working=false;}
 }
 return {tick,start(){const timer=setInterval(()=>tick().catch(()=>{}),1500);return()=>clearInterval(timer);}};
}
