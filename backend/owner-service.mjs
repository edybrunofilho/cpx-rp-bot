import {randomUUID} from 'node:crypto';
import {discord} from './bot.mjs';
import {fail} from '../lib/cpx/engine.mjs';
import {announcementMessage} from './embeds.mjs';
import {SSU_CHANNEL_ID,SEND_POLLS,validateSsu,ssuMessage} from './ssu.mjs';

export const OWNER_ID = '1300178869319635004';
export const APP_ID = '1542567571255984168';
export const ANNOUNCEMENT_CHANNEL_ID = '1493474807990452345';
export const OWNER_PERMISSIONS = (1099511627776n | 2n | 4n | 16n | 1024n | 2048n | 16384n | 131072n | SEND_POLLS).toString();
export function requireOwner(actor){
  if(actor?.id !== OWNER_ID || actor?.demo) fail('Área exclusiva de joaodayz. Entre com a conta Discord autorizada.',403);
}
export function checkOwnerHierarchy({guild,roles,actor,target,bot,kind}){
  requireOwner({id:actor.user.id});
  const bits=m=>roles.filter(r=>r.id===guild.id||m.roles.includes(r.id)).reduce(( b,r)=>b|BigInt(r.permissions),0n);
  const top=m=>Math.max(0,...roles.filter(r=>m.roles.includes(r.id)).map(r=>r.position));
  const permission={warn:1099511627776n,timeout:1099511627776n,kick:2n,ban:4n}[kind];
  if(!permission) fail('Ação inválida.');
  if(target.user.id===actor.user.id||target.user.id===guild.owner_id||target.user.bot||(bits(target)&8n)!==0n) fail('Este membro está protegido contra esta ação.',403);
  if(actor.user.id!==guild.owner_id&&((bits(actor)&(permission|8n))===0n||top(actor)<=top(target))) fail('Sua permissão ou hierarquia no Discord não permite esta ação.',403);
  if((bits(bot)&(permission|8n))===0n||top(bot)<=top(target)) fail('Verifique a permissão e a posição do cargo do bot.',403);
}
export function createOwnerService(store,e,api=discord,{recover=true}={}){
  const db=store.db;
  const request=(path,options)=>api(path,e.DISCORD_BOT_TOKEN,options);
  db.exec(`
    CREATE TABLE IF NOT EXISTS owner_operations(id TEXT PRIMARY KEY,actor TEXT NOT NULL,kind TEXT NOT NULL,target TEXT NOT NULL,reason TEXT NOT NULL,minutes INTEGER NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,status TEXT NOT NULL,error TEXT);
    CREATE TABLE IF NOT EXISTS owner_ssu_drafts(operation_id TEXT PRIMARY KEY REFERENCES owner_operations(id),payload TEXT NOT NULL,message_id TEXT);
    CREATE TABLE IF NOT EXISTS owner_warnings(id TEXT PRIMARY KEY,actor TEXT NOT NULL,target TEXT NOT NULL,reason TEXT NOT NULL,at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS owner_area(id INTEGER PRIMARY KEY CHECK(id=1),category_id TEXT,channel_id TEXT,message_id TEXT);
    CREATE TABLE IF NOT EXISTS owner_logs(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT,detail TEXT NOT NULL,at INTEGER NOT NULL);
    CREATE TRIGGER IF NOT EXISTS owner_logs_no_update BEFORE UPDATE ON owner_logs BEGIN SELECT RAISE(ABORT,'Logs are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS owner_logs_no_delete BEFORE DELETE ON owner_logs BEGIN SELECT RAISE(ABORT,'Logs are append-only'); END;
  `);
  const audit=(actor,action,target,detail)=>db.prepare('INSERT INTO owner_logs VALUES(?,?,?,?,?,?)').run(randomUUID(),actor.id,action,target,detail,Date.now());
  // An interrupted remote operation must never be retried automatically.
  if(recover)for(const row of db.prepare("SELECT * FROM owner_operations WHERE status='processing'").all()){
    db.prepare("UPDATE owner_operations SET status='uncertain',error=? WHERE id=?").run('Serviço reiniciado durante a ação. Confira o Discord antes de repetir.',row.id);
    audit({id:row.actor},row.kind+':uncertain',row.target,'Reinício durante a execução.');
  }
  async function member(actor,id){
    requireOwner(actor);if(!/^\d{17,22}$/.test(id||''))fail('ID do membro inválido.');
    const m=await request('/guilds/'+e.DISCORD_GUILD_ID+'/members/'+id);
    return {id:m.user.id,name:m.nick||m.user.global_name||m.user.username,username:m.user.username,roles:m.roles,joinedAt:m.joined_at,timeoutUntil:m.communication_disabled_until||null,bot:!!m.user.bot,warnings:db.prepare('SELECT id,reason,at FROM owner_warnings WHERE target=? ORDER BY at DESC LIMIT 50').all(id)};
  }
  async function hierarchy(actor,target,kind){
    requireOwner(actor);
    if(kind==='announcement'||kind==='ssu')return announcementChannel(actor,target,kind);
    const root='/guilds/'+e.DISCORD_GUILD_ID;
    const [guild,roles,a,t,b]=await Promise.all([request(root),request(root+'/roles'),request(root+'/members/'+actor.id),request(root+'/members/'+target),request('/users/@me')]);
    const bot=await request(root+'/members/'+b.id);
    if(a.pending)fail('Conclua a verificação do servidor.',403);
    checkOwnerHierarchy({guild,roles,actor:a,target:t,bot,kind});
  }
  async function announcementChannel(actor,id,kind='announcement'){
    requireOwner(actor);
    if(id!==(kind==='ssu'?SSU_CHANNEL_ID:ANNOUNCEMENT_CHANNEL_ID))fail('Canal de publicação não autorizado.',403);
    const root='/guilds/'+e.DISCORD_GUILD_ID;
    const [channel,guild,roles,ownerMember,botUser]=await Promise.all([request('/channels/'+id),request(root),request(root+'/roles'),request(root+'/members/'+actor.id),request('/users/@me')]);
    if(channel.id!==id||channel.guild_id!==e.DISCORD_GUILD_ID||![0,5].includes(channel.type))fail('Canal de publicação inválido ou pertencente a outro servidor.',403);
    if(ownerMember.pending)fail('Conclua a verificação do servidor.',403);
    const botMember=await request(root+'/members/'+botUser.id);
    const effective=m=>{
      let bits=roles.filter(r=>r.id===guild.id||m.roles.includes(r.id)).reduce((b,r)=>b|BigInt(r.permissions),0n);
      if(m.user.id===guild.owner_id||(bits&8n)!==0n)return 1024n|2048n|16384n|131072n|SEND_POLLS;
      const list=channel.permission_overwrites||[];
      const all=list.find(o=>o.type===0&&o.id===guild.id);
      if(all)bits=(bits&~BigInt(all.deny))|BigInt(all.allow);
      let denied=0n,allowed=0n;
      for(const o of list.filter(o=>o.type===0&&m.roles.includes(o.id))){denied|=BigInt(o.deny);allowed|=BigInt(o.allow);}
      bits=(bits&~denied)|allowed;
      const personal=list.find(o=>o.type===1&&o.id===m.user.id);
      if(personal)bits=(bits&~BigInt(personal.deny))|BigInt(personal.allow);
      return bits;
    };
    if((effective(ownerMember)&3072n)!==3072n)fail('Você precisa poder ver e enviar mensagens no canal.',403);
    const required=1024n|2048n|16384n|131072n;
    if((effective(botMember)&required)!==required)fail('O bot precisa ver o canal, enviar mensagens, inserir links (embeds) e mencionar @everyone.',403);
    if(kind==='ssu'&&(effective(botMember)&SEND_POLLS)===0n)fail('O bot precisa da permissão Enviar enquetes no canal da SSU.',403);
    return channel;
  }
  function ssuDraft(actor,id){
    requireOwner(actor);
    const row=db.prepare('SELECT o.*,d.payload FROM owner_operations o JOIN owner_ssu_drafts d ON d.operation_id=o.id WHERE o.id=? AND o.actor=? AND o.kind=?').get(id,actor.id,'ssu');
    if(!row)fail('Prévia da SSU não encontrada.',404);
    if(row.status!=='pending'||row.expires<Date.now())fail('Esta prévia foi encerrada ou expirou. Abra uma nova votação pelo painel.',409);
    return validateSsu(JSON.parse(row.payload));
  }
  async function prepare(actor,input){
    requireOwner(actor);
    const {kind}=input,ssu=kind==='ssu'?validateSsu(input):null,target=kind==='ssu'?SSU_CHANNEL_ID:kind==='announcement'?ANNOUNCEMENT_CHANNEL_ID:input.target,reason=ssu?ssuMessage(ssu).embeds[0].description:typeof input.reason==='string'?input.reason.trim():'';
    if(!['warn','timeout','kick','ban','announcement','ssu'].includes(kind)||!/^\d{17,22}$/.test(target||''))fail('Escolha uma ação e um ID válidos.');
    if(reason.length<3||reason.length>(['announcement','ssu'].includes(kind)?1800:180))fail('Texto fora do limite permitido para esta ação.');
    if(input.replaceId){if(!ssu)fail('A edição só se aplica a uma prévia de SSU.');ssuDraft(actor,input.replaceId);}
    const minutes=kind==='timeout'?Number(input.minutes):0;
    if(!Number.isInteger(minutes)||minutes<0||minutes>1440)fail('Timeout deve ter de 0 a 1440 minutos.');
    const channel=await hierarchy(actor,target,kind);
    const info=['announcement','ssu'].includes(kind)?channel:await member(actor,target),now=Date.now(),id=randomUUID();
    store.transaction(()=>{
      if(input.replaceId){ssuDraft(actor,input.replaceId);db.prepare("UPDATE owner_operations SET status='superseded' WHERE id=?").run(input.replaceId);}
      db.prepare("UPDATE owner_operations SET status='expired' WHERE status='pending' AND expires<?").run(now);
      db.prepare("INSERT INTO owner_operations VALUES(?,?,?,?,?,?,?,?,'pending',NULL)").run(id,actor.id,kind,target,reason,minutes,now,now+300000);
      if(ssu)db.prepare('INSERT INTO owner_ssu_drafts(operation_id,payload) VALUES(?,?)').run(id,JSON.stringify(ssu));
    });
    return {id,kind,target,name:info.name,reason,minutes,expires:now+300000,...(ssu?{ssu}:{})};
  }
  async function confirm(actor,id){
    requireOwner(actor);
    const row=store.transaction(()=>{
      const r=db.prepare('SELECT * FROM owner_operations WHERE id=? AND actor=?').get(id,actor.id);
      if(!r)fail('Confirmação não encontrada.',404);
      if(r.status!=='pending')fail('Esta confirmação já foi utilizada. Consulte os logs.',409);
      if(r.expires<Date.now())fail('Confirmação expirada. Revise novamente.',409);
      db.prepare("UPDATE owner_operations SET status='processing' WHERE id=?").run(id);
      audit(actor,r.kind+':requested',r.target,r.reason);
      return r;
    });
    try{
      await hierarchy(actor,row.target,row.kind);
      const base='/guilds/'+e.DISCORD_GUILD_ID;
      const headers={'X-Audit-Log-Reason':encodeURIComponent(('cpx guardian | '+actor.id+' | '+row.reason).slice(0,300))};
      if(row.kind==='warn')db.prepare('INSERT INTO owner_warnings VALUES(?,?,?,?,?)').run(row.id,actor.id,row.target,row.reason,Date.now());
      if(row.kind==='timeout')await request(base+'/members/'+row.target,{method:'PATCH',headers,body:JSON.stringify({communication_disabled_until:row.minutes?new Date(Date.now()+row.minutes*60000).toISOString():null})});
      if(row.kind==='kick')await request(base+'/members/'+row.target,{method:'DELETE',headers});
      if(row.kind==='ban')await request(base+'/bans/'+row.target,{method:'PUT',headers,body:JSON.stringify({delete_message_seconds:0})});
      if(row.kind==='announcement'){
        await request('/channels/'+row.target+'/messages',{method:'POST',body:JSON.stringify({...announcementMessage(row.reason),nonce:row.id.replaceAll('-','').slice(0,25),enforce_nonce:true})});
      }
      if(row.kind==='ssu'){
        const draft=db.prepare('SELECT payload FROM owner_ssu_drafts WHERE operation_id=?').get(row.id);
        if(!draft)fail('O rascunho da SSU não foi encontrado.',404);
        const message=await request('/channels/'+row.target+'/messages',{method:'POST',body:JSON.stringify({...ssuMessage(JSON.parse(draft.payload)),nonce:row.id.replaceAll('-','').slice(0,25),enforce_nonce:true})});
        if(!/^\d{17,22}$/.test(message?.id||''))throw Error('Resposta de publicação incompleta.');
        db.prepare('UPDATE owner_ssu_drafts SET message_id=? WHERE operation_id=?').run(message.id,row.id);
      }
      store.transaction(()=>{db.prepare("UPDATE owner_operations SET status='applied' WHERE id=?").run(id);audit(actor,row.kind+':applied',row.target,row.reason);});
      return {id,status:'applied',message:(row.kind==='ssu'?'Votação SSU publicada no canal configurado.':'Ação concluída.')+' Registro: '+id};
    }catch(error){
      const status=error.status>=400&&error.status<500?'failed':'uncertain';
      const message=status==='uncertain'?'Resposta não confirmada. Confira o Discord antes de repetir.':'Ação recusada. Verifique permissões, hierarquia e disponibilidade do membro.';
      store.transaction(()=>{db.prepare('UPDATE owner_operations SET status=?,error=? WHERE id=?').run(status,message,id);audit(actor,row.kind+':'+status,row.target,message);});
      return {id,status,message};
    }
  }
  function cancel(actor,id){requireOwner(actor);const r=db.prepare("UPDATE owner_operations SET status='cancelled' WHERE id=? AND actor=? AND status='pending'").run(id,actor.id);if(!r.changes)fail('Confirmação já encerrada.',409);return {message:'Ação cancelada.'};}
  function state(actor){requireOwner(actor);return {ownerId:OWNER_ID,logs:db.prepare('SELECT * FROM owner_logs ORDER BY at DESC,rowid DESC LIMIT 100').all(),warnings:db.prepare('SELECT * FROM owner_warnings ORDER BY at DESC LIMIT 100').all(),operations:db.prepare('SELECT * FROM owner_operations ORDER BY created DESC LIMIT 50').all(),area:db.prepare('SELECT * FROM owner_area WHERE id=1').get()||null};}
  function config(actor){requireOwner(actor);return {ownerId:OWNER_ID,guildId:e.DISCORD_GUILD_ID,applicationId:e.DISCORD_CLIENT_ID,announcementChannelId:ANNOUNCEMENT_CHANNEL_ID,portal:e.PUBLIC_ORIGIN,aiEnabled:e.CPX_AI_ENABLED==='true',roles:{admin:e.DISCORD_ADMIN_ROLE_ID,mayor:e.DISCORD_MAYOR_ROLE_ID,government:e.DISCORD_GOVERNMENT_ROLE_ID}};}
  return {member,prepare,confirm,cancel,state,config,ssuDraft};
}
