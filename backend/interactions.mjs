import {isOwnerInteraction,ownerImmediate,executeOwnerInteraction} from './owner-interactions.mjs';
import {requireOwner} from './owner-service.mjs';
import {createPublicKey,verify,createHash} from 'node:crypto';
import {money,fail} from '../lib/cpx/engine.mjs';
import {guardianCommands} from '../lib/cpx/guardian.mjs';
import {formatReply,commandTitle} from './embeds.mjs';
import {createStaffService,isStaffCommand,STAFF_GUILD_ID} from './staff-interactions.mjs';
import {createRgService,isRgCommand} from './rg-interactions.mjs';
import {createCnhService,isCnhCommand} from './cnh-interactions.mjs';
import {createCnhExamService,isCnhExamInteraction} from './cnh-exam.mjs';
import {createBankService,isBankCommand,BANK_GUILD_ID} from './bank-interactions.mjs';
export function validSignature(raw,signature,timestamp,publicKey,now=Date.now()){
 try{if(!/^[0-9a-f]{128}$/i.test(signature||'')||!/^\d{10,13}$/.test(timestamp||'')||!/^[0-9a-f]{64}$/i.test(publicKey||'')||Math.abs(now-Number(timestamp)*1000)>300000)return false;const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(publicKey,'hex')]),format:'der',type:'spki'});return verify(null,Buffer.concat([Buffer.from(timestamp),raw]),key,Buffer.from(signature,'hex'));}catch{return false;}
}
export function interactionRequestId(id){const hex=createHash('sha256').update('discord:'+id).digest('hex').slice(0,32);return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);}
export async function executeCommand(i,store,service,e){
 if(i.guild_id!==e.DISCORD_GUILD_ID||i.application_id!==e.DISCORD_CLIENT_ID||!i.member?.user?.id)fail('Use este comando dentro do servidor CPX.',403);
 if(i.data?.name!=='cpx')fail('Comando não reconhecido.');
 const actor=await service.memberActor(i.member.user.id);store.register(i.member.user);
 const group=i.data.options?.[0],sub=group?.type===2?group.options?.[0]:group;
 const name=group?.type===2?'ticket_'+sub?.name:sub?.name;
 const o=Object.fromEntries((sub?.options||[]).map(x=>[x.name,x.value]));
 const requestId=interactionRequestId(i.id),run=fields=>store.action(actor,{...fields,requestId});
 const view=store.snapshot(actor);
 if(name==='ajuda')return guardianCommands.map(([name,desc])=>'/cpx '+name+' — '+desc).join('\n');
 if(name==='portal')return 'Portal da cidade: '+e.PUBLIC_ORIGIN;
 if(name==='status')return 'O cpx guardian está disponível. O banco e o atendimento utilizam o mesmo banco de dados do portal.';
 if(name==='saldo')return 'Saldo disponível: **'+money(view.me.balance)+'**.\nDinheiro fictício, exclusivo do roleplay.';
 if(name==='rg')return `**${view.me.name}**\nRG: ${view.me.rg}\nProfissão: ${view.me.job}\n\nDocumento fictício. Edite seu RG e sua foto no portal.`;
 if(name==='extrato')return view.transactions.filter(t=>t.from===actor.id||t.to===actor.id).slice(0,5).map(t=>`${t.to===actor.id?'+':'−'} ${money(t.amount)} · ${t.reason}\nComprovante: ${t.id}`).join('\n\n')||'Nenhuma movimentação registrada.';
 if(name==='perguntar')return (await service.ask(actor,{question:o.pergunta,aiConsent:o.usar_ia===true})).answer;
 if(name==='avisos'){run({action:'notify',enabled:o.ativar});return 'As notificações financeiras por mensagem direta foram '+(o.ativar?'ativadas':'desativadas')+'.';}
 if(['transferir','ajustar','pagar','advertir','castigo','comunicado','ticket_fechar'].includes(name)&&o.confirmar!==true)fail('Nenhuma ação realizada. Confira os dados e selecione confirmar: verdadeiro.');
 if(name==='transferir'||name==='ajustar'||name==='pagar'){const result=run({action:name==='transferir'?'transfer':name==='ajustar'?'adjust':'treasury',target:o.jogador,amount:o.valor,reason:o.motivo,operation:o.operacao,treasury:o.caixa});const tx=result.transactions.find(t=>t.requestId===requestId);return 'Movimentação RP registrada. Comprovante: '+(tx?.id||'consulte o extrato')+'. O status da DM está no site.';}
 if(name==='advertir'){run({action:'warn',target:o.jogador,reason:o.motivo,confirm:true});return 'A advertência interna foi registrada e está disponível no portal. Esta ação não aplica uma restrição temporária.';}
 if(name==='castigo'){run({action:'timeout',target:o.jogador,reason:o.motivo,minutes:o.minutos,confirm:true});return 'Solicitação de timeout registrada. A aplicação depende das permissões e da hierarquia no Discord. Consulte o resultado no portal.';}
 if(name==='comunicado'){run({action:'post',channel:o.canal,text:o.texto});return 'Comunicado publicado no canal do Instaplexo.';}
 if(name==='ticket_abrir'){const result=run({action:'ticket_open',subject:o.assunto,text:o.mensagem});const t=result.tickets[0];return 'Ticket privado aberto: **'+t.subject+'**\nID: '+t.id+'\nAcompanhe no portal ou use /cpx ticket responder.';}
 if(name==='ticket_listar')return view.tickets.slice(0,10).map(t=>`${t.status==='open'?'Aberto':'Encerrado'} · ${t.subject}\nID: ${t.id}`).join('\n\n')||'Você não tem tickets. Use /cpx ticket abrir.';
 if(name==='ticket_responder'){run({action:'ticket_reply',id:o.id,text:o.mensagem});return 'Resposta salva no ticket e sincronizada com o site.';}
 if(name==='ticket_fechar'){run({action:'ticket_close',id:o.id});return 'Ticket encerrado.';}
 fail('Função não encontrada. Use /cpx ajuda.');
}
export function createInteractionHandler(store,service,e,replyFetch=fetch,owner=null){
 const windows=new Map();
 const staff=createStaffService(e);
 const rg=createRgService(e);
 const cnhExam=createCnhExamService(store,e);
 const cnh=createCnhService(e,{approval:cnhExam.approval});
 const bank=createBankService(store,e);
 return async function(req,res){
  const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>65536){res.writeHead(413);res.end();return;}chunks.push(c);}const raw=Buffer.concat(chunks);
  if(!validSignature(raw,req.headers['x-signature-ed25519'],req.headers['x-signature-timestamp'],e.DISCORD_PUBLIC_KEY)){res.writeHead(401);res.end('Invalid signature');return;}
  let i;try{i=JSON.parse(raw.toString());}catch{res.writeHead(400);res.end();return;}
  const respond=data=>{if(data.type===4)data={...data,data:formatReply(data.data,'Aviso do cpx guardian',true)};res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(i.type===1){respond({type:1});return;}
  const staffRequest=isStaffCommand(i)&&i.guild_id===STAFF_GUILD_ID;
  const bankRequest=isBankCommand(i)&&i.guild_id===BANK_GUILD_ID;
  if(![2,3,5].includes(i.type)||i.application_id!==e.DISCORD_CLIENT_ID||(i.guild_id!==e.DISCORD_GUILD_ID&&!staffRequest&&!bankRequest)){respond({type:4,data:{content:'Comando indisponível neste contexto.',flags:64,allowed_mentions:{parse:[]}}});return;}
  const id=i.member?.user?.id;if(!id){respond({type:4,data:{content:'Membro inválido.',flags:64}});return;}
  if(isOwnerInteraction(i)){try{if(i.guild_id!==e.DISCORD_GUILD_ID)fail('Painel indisponível neste servidor.',403);requireOwner({id});if(!owner)fail('Painel indisponível.',503);const immediate=ownerImmediate(i,owner);if(immediate){respond(immediate);return;}}catch(error){respond({type:4,data:{content:error.status?error.message:'Área indisponível.',flags:64,allowed_mentions:{parse:[]}}});return;}}
  const now=Date.now(),w=windows.get(id)||{until:now+60000,count:0};if(w.until<now){w.count=0;w.until=now+60000;}w.count++;windows.set(id,w);for(const[k,v]of windows)if(v.until<now)windows.delete(k);
  if(w.count>20){respond({type:4,data:{content:'Aguarde um minuto antes de continuar.',flags:64}});return;}
  const inserted=store.db.prepare('INSERT OR IGNORE INTO interactions(id,status,at) VALUES(?,?,?)').run(i.id,'processing',Date.now());
  if(!inserted.changes){respond({type:4,data:{content:'Esta solicitação já foi recebida. Confira o resultado antes de repetir a operação.',flags:64}});return;}
  // Acknowledge before any Discord lookup or AI call (3-second deadline).
  const examRequest=isCnhExamInteraction(i);
  respond(examRequest&&i.type===3?{type:6}:{type:5,data:{flags:64}});
  let content,status='done';try{content=staffRequest?await staff.execute(i):bankRequest?await bank.execute(i):examRequest?await cnhExam.execute(i):isRgCommand(i)?await rg.execute(i):isCnhCommand(i)?await cnh.execute(i):isOwnerInteraction(i)?await executeOwnerInteraction(i,owner,e):await executeCommand(i,store,service,e);}catch(error){status='failed';content=error.status?error.message:'Não foi possível concluir. Confira o Discord antes de repetir.';}
  store.db.prepare('UPDATE interactions SET status=? WHERE id=?').run(status,i.id);
  try{await replyFetch('https://discord.com/api/v10/webhooks/'+e.DISCORD_CLIENT_ID+'/'+encodeURIComponent(i.token)+'/messages/@original',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(formatReply(content,status==='failed'?'Não foi possível concluir':commandTitle(i),status==='failed')),signal:AbortSignal.timeout(10000)});}catch{/* Do not log interaction tokens; results remain visible in the portal. */}
 };
}
