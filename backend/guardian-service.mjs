import {discord} from './bot.mjs';
import {contextualAnswer,knowledge,guardianCommands,ensureGuardian} from '../lib/cpx/guardian.mjs';
import {fail} from '../lib/cpx/engine.mjs';
export function roleFromMember(member,e){return [['admin',e.DISCORD_ADMIN_ROLE_ID],['mayor',e.DISCORD_MAYOR_ROLE_ID],['deputy',e.DISCORD_DEPUTY_ROLE_ID],['government',e.DISCORD_GOVERNMENT_ROLE_ID]].find(([,id])=>id&&member.roles.includes(id))?.[0]||'citizen';}
export function verifyHierarchy({guild,roles,actor,target,bot}){
 const owned=actor.user.id===guild.owner_id;
 const permissions=m=>roles.filter(r=>r.id===guild.id||m.roles.includes(r.id)).reduce((bits,r)=>bits|BigInt(r.permissions),0n);
 const highest=m=>Math.max(0,...roles.filter(r=>m.roles.includes(r.id)).map(r=>r.position));
 const capable=m=>(permissions(m)&(8n|1099511627776n))!==0n;
 if(!owned&&!capable(actor))fail('Você precisa da permissão Moderar membros no Discord.',403);
 if(!capable(bot))fail('O bot precisa da permissão Moderar membros.',403);
 if(target.user.id===guild.owner_id||target.user.bot||(permissions(target)&8n)!==0n)fail('Este membro não pode receber timeout.',403);
 if(target.user.id===actor.user.id||highest(bot)<=highest(target)||(!owned&&highest(actor)<=highest(target)))fail('A hierarquia de cargos impede esta ação.',403);
}
export function createGuardianService(store,e,api=discord,aiFetch=fetch){
 const request=(path,options)=>api(path,e.DISCORD_BOT_TOKEN,options);
 async function memberActor(id){let member;try{member=await request('/guilds/'+e.DISCORD_GUILD_ID+'/members/'+id);}catch(err){if(err.status===404)fail('Entre no servidor CPX para continuar.',403);fail('Não foi possível verificar seus cargos.',503);}if(member.pending)fail('Conclua a verificação de entrada no servidor.',403);return {id,role:roleFromMember(member,e),demo:false};}
 async function ask(actor,input){
  if(typeof input.question!=='string'||input.question.trim().length<2||input.question.length>1000)fail('Escreva uma pergunta de 2 a 1000 caracteres.');
  const question=input.question.trim(),local=contextualAnswer(question,store.snapshot(actor));
  if(local)return {answer:local,mode:'contextual'};
  if(input.aiConsent!==true||e.CPX_AI_ENABLED!=='true'||!e.OPENAI_API_KEY||!e.OPENAI_MODEL)return {answer:'Posso orientar sobre banco, RG, cargos, avisos e tickets. Para uma dúvida específica, abra um atendimento. A IA opcional não está ativada ou não foi autorizada nesta pergunta.',mode:'contextual'};
  const day=new Date().toISOString().slice(0,10);
  store.transaction(()=>{for(const [key,max]of [[actor.id,10],['*',100]]){const r=store.db.prepare('SELECT count FROM ai_usage WHERE user_id=? AND day=?').get(key,day);if(r&&r.count>=max)fail('Limite diário de perguntas à IA atingido. Use o atendimento.',429);}for(const key of [actor.id,'*'])store.db.prepare('INSERT INTO ai_usage(user_id,day,count) VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1').run(key,day);});
  try{
   const res=await aiFetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+e.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:e.OPENAI_MODEL,store:false,max_output_tokens:1200,instructions:knowledge+' Responda em português, em até 1600 caracteres. Não afirme que realizou ações. Não peça segredos. Regras fornecidas pelo responsável: '+String(e.CPX_RULES_TEXT||'Nenhuma regra adicional cadastrada.').slice(0,8000),input:question}),signal:AbortSignal.timeout(10000)});
   if(!res.ok)throw Error('provider');const data=await res.json();const answer=(data.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n').trim();
   if(!answer||data.status==='incomplete')throw Error('empty');return {answer:answer.slice(0,1600)+'\n\nResposta de IA: confirme orientações importantes com a administração.',mode:'ai'};
  }catch{return {answer:'A IA não respondeu a tempo. Nenhuma ação foi executada. Tente a ajuda contextual ou abra um ticket.',mode:'unavailable'};}
 }
 let working=false;
 async function tick(){
  if(working)return;working=true;let job;
  try{
   job=store.transaction(()=>{const s=ensureGuardian(store.get()),j=[...s.moderation].reverse().find(j=>j.status==='pending');if(!j)return null;j.status='processing';store.save(s);return {...j};});if(!job)return;
   const actor=await memberActor(job.actorId);if(actor.role!=='admin')fail('O responsável perdeu o cargo de administrador.',403);
   const [guild,roles,actorMember,targetMember,botUser]=await Promise.all([request('/guilds/'+e.DISCORD_GUILD_ID),request('/guilds/'+e.DISCORD_GUILD_ID+'/roles'),request('/guilds/'+e.DISCORD_GUILD_ID+'/members/'+job.actorId),request('/guilds/'+e.DISCORD_GUILD_ID+'/members/'+job.target),request('/users/@me')]);
   const botMember=await request('/guilds/'+e.DISCORD_GUILD_ID+'/members/'+botUser.id);
   verifyHierarchy({guild,roles,actor:actorMember,target:targetMember,bot:botMember});
   if(job.until&&Date.parse(job.until)<=Date.now())fail('A solicitação expirou antes da execução.');
   await request('/guilds/'+e.DISCORD_GUILD_ID+'/members/'+job.target,{method:'PATCH',headers:{'X-Audit-Log-Reason':encodeURIComponent(('cpx guardian | '+job.actor+' | '+job.reason).slice(0,250))},body:JSON.stringify({communication_disabled_until:job.until})});
   store.transaction(()=>{const s=ensureGuardian(store.get()),j=s.moderation.find(j=>j.id===job.id);j.status='applied';j.completedAt=new Date().toISOString();store.save(s);});
  }catch(err){if(job)store.transaction(()=>{const s=ensureGuardian(store.get()),j=s.moderation.find(j=>j.id===job.id);j.status='failed';j.error=err.status&&err.message&&!err.message.startsWith('Discord indisponível')?err.message:'Falha no Discord. Verifique o estado do membro antes de tentar novamente.';store.save(s);});}finally{working=false;}
 }
 return {memberActor,ask,tick,commands:guardianCommands,start(){store.transaction(()=>{const s=ensureGuardian(store.get());for(const j of s.moderation)if(j.status==='processing'){j.status='failed';j.error='Serviço reiniciado. Confira o estado no Discord antes de tentar novamente.';}store.save(s);});const timer=setInterval(()=>tick().catch(()=>{}),2000);return ()=>clearInterval(timer);}};
}
