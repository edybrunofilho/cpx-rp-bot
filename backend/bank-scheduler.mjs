import {createHash} from 'node:crypto';
import {discord} from './bot.mjs';
import {embedMessage,CPX_GREEN} from './embeds.mjs';
import {BANK_CHANNEL_ID} from './bank-interactions.mjs';
import {money} from '../lib/cpx/engine.mjs';

const TIME_ZONE='America/Campo_Grande';
const SYSTEM_ACTOR={id:'cpx-guardian-system',name:'cpx guardian',role:'system'};

const uuidFor=value=>{
  const hex=createHash('sha256').update(value).digest('hex').slice(0,32);
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
};
const localParts=date=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));

export function createBankScheduler(store,e,api=discord,{now=()=>new Date(),intervalMs=300000}={}){
  store.db.exec("CREATE TABLE IF NOT EXISTS bank_jobs(job_key TEXT PRIMARY KEY,status TEXT NOT NULL,detail TEXT NOT NULL,updated INTEGER NOT NULL)");
  const request=(path,options)=>api(path,e.DISCORD_BOT_TOKEN,options);
  let working=false;

  async function distribute({key,title,amount,reason}){
    const saved=store.db.prepare('SELECT status,detail FROM bank_jobs WHERE job_key=?').get(key);
    if(saved?.status==='published')return false;
    let detail=saved?JSON.parse(saved.detail):null;
    if(saved?.status!=='paid'){
      const players=store.get().players.filter(player=>/^\d{17,22}$/.test(player.id));
      if(!players.length)return false;
      for(const player of players){
        store.action(SYSTEM_ACTOR,{action:'scheduled_credit',target:player.id,amount:(amount/100).toFixed(2),reason,requestId:uuidFor('bank-job:'+key+':'+player.id),forceNotifications:true});
      }
      detail={title,amount,reason,recipients:players.length,total:amount*players.length,at:now().toISOString()};
      store.db.prepare("INSERT INTO bank_jobs(job_key,status,detail,updated) VALUES(?,?,?,?) ON CONFLICT(job_key) DO UPDATE SET status=excluded.status,detail=excluded.detail,updated=excluded.updated").run(key,'paid',JSON.stringify(detail),Date.now());
    }
    const payload=embedMessage(detail.title,'Benefício bancário distribuído automaticamente para todas as contas cadastradas.',{color:CPX_GREEN,timestamp:detail.at,fields:[
      {name:'Valor por jogador',value:money(detail.amount),inline:true},
      {name:'Contas beneficiadas',value:String(detail.recipients),inline:true},
      {name:'Total distribuído',value:money(detail.total),inline:true},
      {name:'Motivo',value:detail.reason},
      {name:'Avisos privados',value:'Cada jogador recebeu um aviso por DM. Se as mensagens privadas estiverem bloqueadas, o crédito permanece registrado no extrato.'},
    ],footer:'CPX ROLEPLAY • Valores fictícios, sem valor real'});
    await request('/channels/'+BANK_CHANNEL_ID+'/messages',{method:'POST',body:JSON.stringify(payload)});
    store.db.prepare("UPDATE bank_jobs SET status='published',updated=? WHERE job_key=?").run(Date.now(),key);
    return true;
  }

  async function tick(){
    if(working)return;working=true;
    try{
      await distribute({key:'launch-bonus-3500-v1',title:'Auxílio inicial de R$ 3.500,00',amount:350000,reason:'Auxílio inicial do Banco CPX'});
      const parts=localParts(now());
      if(parts.day==='01')await distribute({key:'monthly-benefit-'+parts.year+'-'+parts.month,title:'Benefício mensal de R$ 500,00',amount:50000,reason:'Benefício mensal do Banco CPX'});
    }finally{working=false;}
  }
  return {tick,start(){tick().catch(error=>console.error('Falha temporária na distribuição bancária:',error?.message||error));const timer=setInterval(()=>tick().catch(error=>console.error('Falha temporária na distribuição bancária:',error?.message||error)),intervalMs);return()=>clearInterval(timer);}};
}
