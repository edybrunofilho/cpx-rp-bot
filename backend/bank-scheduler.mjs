import {createHash} from 'node:crypto';
import {discord} from './bot.mjs';
import {embedMessage,CPX_GREEN} from './embeds.mjs';
import {BANK_CHANNEL_ID,BANK_GUILD_ID} from './bank-interactions.mjs';
import {money} from '../lib/cpx/engine.mjs';

export const BANK_MEMBER_ROLE_ID='1500738314872033380';
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

  async function eligibleMembers(){
    const members=[];let after='0';
    for(let pageNumber=0;pageNumber<100;pageNumber++){
      const page=await request('/guilds/'+BANK_GUILD_ID+'/members?limit=1000&after='+after);
      if(!Array.isArray(page))throw new Error('O Discord não retornou a lista de membros do servidor bancário.');
      for(const member of page){
        if(!member.user?.bot&&member.roles?.includes(BANK_MEMBER_ROLE_ID))members.push(member);
      }
      if(page.length<1000)break;
      after=page.at(-1)?.user?.id;if(!after)break;
    }
    return members;
  }

  function receiptExists(requestId){
    return !!store.db.prepare('SELECT 1 FROM receipts WHERE actor=? AND request_id=?').get(SYSTEM_ACTOR.id,requestId);
  }

  function markJob(key,status,detail){
    store.db.prepare("INSERT INTO bank_jobs(job_key,status,detail,updated) VALUES(?,?,?,?) ON CONFLICT(job_key) DO UPDATE SET status=excluded.status,detail=excluded.detail,updated=excluded.updated").run(key,status,JSON.stringify(detail),Date.now());
  }

  function ensureCredit(member,{jobKey,requestKey,amount,reason,title,legacyRequestKey}){
    const user=member.user;store.register(user);
    const requestId=uuidFor(requestKey+user.id);
    const legacyId=legacyRequestKey?uuidFor(legacyRequestKey+user.id):null;
    const existingJob=store.db.prepare('SELECT status FROM bank_jobs WHERE job_key=?').get(jobKey+user.id);
    if(existingJob)return false;
    if(receiptExists(requestId)||legacyId&&receiptExists(legacyId)){
      markJob(jobKey+user.id,'published',{title,amount,reason,userId:user.id,at:now().toISOString(),legacy:true});
      return false;
    }
    store.action(SYSTEM_ACTOR,{action:'scheduled_credit',target:user.id,amount:(amount/100).toFixed(2),reason,requestId,forceNotifications:true});
    markJob(jobKey+user.id,'paid',{title,amount,reason,userId:user.id,at:now().toISOString()});
    return true;
  }

  async function publishPendingReports(){
    const pending=store.db.prepare("SELECT job_key,detail FROM bank_jobs WHERE status='paid' AND job_key LIKE 'role-%' ORDER BY updated LIMIT 1000").all();
    const groups=new Map();
    for(const row of pending){
      const detail=JSON.parse(row.detail);const key=detail.title+'|'+detail.amount+'|'+detail.reason;
      const group=groups.get(key)||{detail,rows:[]};group.rows.push(row);groups.set(key,group);
    }
    for(const {detail,rows} of groups.values()){
      const recipients=rows.length,total=detail.amount*recipients;
      const payload=embedMessage(detail.title,'Crédito bancário distribuído automaticamente aos membros elegíveis.',{color:CPX_GREEN,timestamp:now().toISOString(),fields:[
        {name:'Cargo autorizado',value:'<@&'+BANK_MEMBER_ROLE_ID+'>',inline:true},
        {name:'Valor por jogador',value:money(detail.amount),inline:true},
        {name:'Contas beneficiadas',value:String(recipients),inline:true},
        {name:'Total distribuído',value:money(total),inline:true},
        {name:'Motivo',value:detail.reason},
        {name:'Avisos privados',value:'Cada jogador recebeu um aviso por DM. Se as mensagens privadas estiverem bloqueadas, o crédito permanece registrado no extrato.'},
      ],footer:'CPX ROLEPLAY • Valores fictícios, sem valor real'});
      await request('/channels/'+BANK_CHANNEL_ID+'/messages',{method:'POST',body:JSON.stringify(payload)});
      const update=store.db.prepare("UPDATE bank_jobs SET status='published',updated=? WHERE job_key=?");
      store.transaction(()=>{for(const row of rows)update.run(Date.now(),row.job_key);});
    }
  }

  async function tick(){
    if(working)return;working=true;
    try{
      const members=await eligibleMembers();const parts=localParts(now());
      for(const member of members){
        ensureCredit(member,{jobKey:'role-registration-v2:',requestKey:'role-registration-bonus-v2:',legacyRequestKey:'bank-job:launch-bonus-3500-v1:',amount:350000,reason:'Bônus único de cadastro do Banco CPX',title:'Bônus de cadastro de R$ 3.500,00'});
        if(parts.day==='01')ensureCredit(member,{jobKey:'role-monthly:'+parts.year+'-'+parts.month+':',requestKey:'bank-job:monthly-benefit-'+parts.year+'-'+parts.month+':',amount:50000,reason:'Benefício mensal do Banco CPX',title:'Benefício mensal de R$ 500,00'});
      }
      await publishPendingReports();
    }finally{working=false;}
  }
  return {tick,start(){tick().catch(error=>console.error('Falha temporária na distribuição bancária:',error?.message||error));const timer=setInterval(()=>tick().catch(error=>console.error('Falha temporária na distribuição bancária:',error?.message||error)),intervalMs);return()=>clearInterval(timer);}};
}
