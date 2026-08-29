import {requireOwner} from './owner-service.mjs';
import {fail} from '../lib/cpx/engine.mjs';
import {embedMessage,announcementMessage,CPX_GREEN,CPX_RED} from './embeds.mjs';
import {ERLC_PLAYERS_CHANNEL_ID,SSU_CHANNEL_ID,SSU_DEFAULTS,SSU_MODELS,ssuMessage} from './ssu.mjs';

const actionNames={warn:'Advertência',timeout:'Restrição temporária',kick:'Expulsão',ban:'Banimento',announcement:'Anúncio',ssu:'Votação SSU'};
const statusNames={requested:'Solicitação registrada',applied:'Concluída',failed:'Recusada',uncertain:'Resultado não confirmado'};
const info=(name,value,inline=false)=>({name,value:String(value??'Não informado.'),inline});
const date=value=>value&&!Number.isNaN(Date.parse(value))?'<t:'+Math.floor(Date.parse(value)/1000)+':f>':'Não informado.';

const userOption={type:6,name:'membro',description:'Membro do servidor',required:true};
export const ownerCommands=[
  {name:'cpxpainel',description:'Abrir o painel de controle exclusivo de joaodayz.',type:1,default_member_permissions:'0'},
  {name:'guardian',description:'Painel exclusivo de joaodayz.',type:1,default_member_permissions:'0'},
  {name:'warn',description:'Preparar uma advertência com confirmação',type:1,default_member_permissions:'0',options:[userOption,{type:3,name:'motivo',description:'Motivo da advertência',required:true,min_length:3,max_length:180}]},
  {name:'userinfo',description:'Consultar um membro na área privada',type:1,default_member_permissions:'0',options:[userOption]},
];
const row=components=>({type:1,components});
const button=(label,id,style=2)=>({type:2,label,custom_id:id,style});
const field=(id,label,max=180)=>row([{type:4,custom_id:id,label,style:1,required:true,max_length:max}]);
const values=i=>Object.fromEntries((i.data.components||[]).flatMap(r=>r.components||[]).map(c=>[c.custom_id,c.value]));
export const isOwnerInteraction=i=>['cpxpainel','guardian','warn','userinfo'].includes(i.data?.name)||String(i.data?.custom_id||'').startsWith('own:');
function ssuModal(model='vote',draft=null,replaceId=''){
  draft={model,...SSU_MODELS[model],...(draft||{})};
  const input=(id,label,value,max,style=1)=>row([{type:4,custom_id:id,label,value:String(value),style,required:true,max_length:max}]);
  const components=model==='vote'?[
    ...draft.times.map((time,index)=>input('time'+(index+1),'Horário '+(index+1)+' (HH:MM)',time,5)),
    input('message','Mensagem: use {h1}, {h2} e {h3}',draft.message,3500,2),
    input('duration','Duração da votação (1 a 768 horas)',draft.duration,3),
  ]:model==='start'?[
    input('temperature','Temperatura em °C',draft.temperature,5),
    input('message','Use {players} e {temperature}; players é automático',draft.message,3500,2),
  ]:[input('message','Mensagem do Server Off',draft.message,3500,2)];
  return {type:9,data:{custom_id:'own:ssu-submit:'+model+(replaceId?':'+replaceId:''),title:'Editar '+SSU_MODELS[model].label,components}};
}
function ssuChooser(){
  const message=embedMessage('Área de SSU','Escolha um dos três modelos. Antes da publicação, você poderá editar o conteúdo e revisar a prévia.',{components:[row([{type:3,custom_id:'own:ssu-model',placeholder:'Escolha o modelo da SSU',min_values:1,max_values:1,options:[
    {label:'1 — Votação de horários',value:'vote',description:'Edite três horários e publique uma enquete.'},
    {label:'2 — Server Off',value:'offline',description:'Avise que a cidade foi fechada.'},
    {label:'3 — Server Start',value:'start',description:'Jogadores automáticos; edite temperatura e abertura.'},
  ]}])]});
  return {type:4,data:{...message,flags:64}};
}
export function ownerImmediate(i,owner=null){
  if(i.type!==3)return null;
  requireOwner({id:i.member?.user?.id});
  const id=i.data.custom_id;
  if(id==='own:ssu')return ssuChooser();
  if(id==='own:ssu-model'){
    const model=i.data.values?.[0];
    if(!Object.hasOwn(SSU_MODELS,model))fail('Modelo de SSU inválido.');
    return ssuModal(model);
  }
  if(id.startsWith('own:ssu-edit:')){
    if(!owner)fail('Painel indisponível.',503);
    const draftId=id.slice('own:ssu-edit:'.length);
    const draft=owner.ssuDraft({id:i.member.user.id},draftId);
    return ssuModal(draft.model||SSU_DEFAULTS.model,draft,draftId);
  }
  if(id==='own:announcement')return {type:9,data:{custom_id:'own:announcement-submit',title:'Revisar anúncio',components:[row([{type:4,custom_id:'text',label:'Texto do anúncio',style:2,required:true,min_length:3,max_length:1800}])]}};
  if(id==='own:lookup')return {type:9,data:{custom_id:'own:lookup-submit',title:'Consultar membro',components:[field('target','ID numérico do membro',22)]}};
  const match=/^own:(warn|timeout|kick|ban):(\d{17,22})$/.exec(id);
  if(!match)return null;
  const components=[field('reason','Motivo (mínimo de 3 caracteres)')];
  if(match[1]==='timeout')components.push(field('minutes','Duração: 0 a 1440 minutos; 0 remove',4));
  return {type:9,data:{custom_id:'own:prepare:'+match[1]+':'+match[2],title:'Revisar: '+actionNames[match[1]],components}};
}
export function ownerMenu(origin){
  return embedMessage('Painel de controle','Acesso exclusivo à conta **joaodayz.**\nSelecione uma opção abaixo. Anúncios, mensagens de SSU e ações de moderação exigem revisão e confirmação.',{fields:[info('Membros e moderação','Consulte membros e aplique advertências, restrições temporárias, expulsões ou banimentos.'),info('Anúncios','Revise o comunicado antes de publicá-lo no canal oficial com a menção @everyone.'),info('Área de SSU','Escolha entre votação de horários, Server Off e Server Start. O total de jogadores do Server Start é consultado no ER:LC.')],components:[row([button('Membros e moderação','own:lookup'),button('Postar anúncio','own:announcement'),button('Registros','own:logs')]),row([button('Área de SSU','own:ssu',1),button('Jogadores ON','own:erlc-players',1),button('Configurações','own:config')]),row([{type:2,style:5,label:'Painel web',url:origin+'/owner'}])]});
}
export async function executeOwnerInteraction(i,owner,e){
  const actor={id:i.member?.user?.id};requireOwner(actor);
  if(i.guild_id!==e.DISCORD_GUILD_ID||i.application_id!==e.DISCORD_CLIENT_ID)fail('Servidor inválido.',403);
  const opts=Object.fromEntries((i.data.options||[]).map(o=>[o.name,o.value]));
  const id=i.data.custom_id||'',form=values(i);
  if(['guardian','cpxpainel'].includes(i.data.name))return ownerMenu(e.PUBLIC_ORIGIN);
  const ssuSubmit=/^own:ssu-submit:(vote|offline|start)(?::([a-f0-9-]{36}))?$/.exec(id);
  if(ssuSubmit){
    const model=ssuSubmit[1];
    const input={kind:'ssu',model,message:form.message,...(ssuSubmit[2]?{replaceId:ssuSubmit[2]}:{})};
    if(model==='vote')Object.assign(input,{times:[form.time1,form.time2,form.time3],duration:form.duration});
    if(model==='start')Object.assign(input,{temperature:form.temperature});
    const p=await owner.prepare(actor,input);
    const details=p.ssu.model==='vote'?[info('Horários',p.ssu.times.join(' • ')),info('Duração',`${p.ssu.duration} ${p.ssu.duration===1?'hora':'horas'}. Uma escolha por pessoa.`)]:p.ssu.model==='start'?[info('Jogadores online',p.ssu.players,true),info('Temperatura',p.ssu.temperature+' °C',true)]:[];
    const preview=embedMessage('Revisão da SSU','Confira o modelo e a mensagem. Nada foi publicado. Esta confirmação expira em 5 minutos.',{fields:[info('Modelo',SSU_MODELS[p.ssu.model].label),info('Canal',`#${p.name} (${SSU_CHANNEL_ID})`),...details,info('Menção','A publicação mencionará @everyone. Esta prévia não notifica ninguém.')],components:[row([button('Publicar','own:confirm:'+p.id,4),button('Editar','own:ssu-edit:'+p.id),button('Cancelar','own:cancel:'+p.id)])]});
    preview.embeds.push(...ssuMessage(p.ssu).embeds);
    return preview;
  }
  if(id==='own:erlc-players'){
    const server=await owner.publishErlcPlayers(actor);
    return embedMessage('Contagem publicada','O embed com a quantidade atual de jogadores foi enviado publicamente em <#'+ERLC_PLAYERS_CHANNEL_ID+'>.',{fields:[info('Jogadores online',server.currentPlayers,true),info('Capacidade',server.maxPlayers,true)]});
  }
  if(id==='own:config'){const c=owner.config(actor);return embedMessage('Configurações do cpx guardian','Os dados sensíveis não são exibidos neste painel. O canal de anúncios é definido no código; os demais identificadores são configurados nas variáveis privadas da hospedagem.',{fields:[info('Servidor',c.guildId,true),info('Conta autorizada',c.ownerId,true),info('Canal de anúncios',c.announcementChannelId),info('API do ER:LC',c.erlcConfigured?'Configurada.':'Não configurada.',true),info('Cargo da administração',c.roles.admin||'Não configurado.',true),info('Cargo do prefeito',c.roles.mayor||'Não configurado.',true),info('Cargo do governo',c.roles.government||'Não configurado.',true),info('Portal',c.portal)]});}
  if(id==='own:announcement-submit'){
    const p=await owner.prepare(actor,{kind:'announcement',reason:form.text});
    const preview=embedMessage('Revisão do anúncio','Confira o texto, a ortografia e a pontuação antes de publicar. O comunicado abaixo será enviado após a confirmação.',{fields:[info('Destino',`#${p.name} (${p.target})`),info('Notificação','A publicação incluirá a menção @everyone. Esta prévia não notifica os membros.'),info('Validade','A confirmação expira em 5 minutos.')],components:[row([button('Publicar anúncio','own:confirm:'+p.id,4),button('Cancelar','own:cancel:'+p.id)])]});
    preview.embeds.push(...announcementMessage(p.reason).embeds);
    return preview;
  }
  if(id==='own:logs'){
    const data=owner.state(actor);
    return embedMessage('Registros do painel privado',data.logs.length?'Últimas ações registradas.':'Nenhum registro disponível.',{fields:data.logs.slice(0,8).map(l=>{const [action,status]=l.action.split(':');return info((actionNames[action]||'Ação')+' — '+(statusNames[status]||'Registrada'),`Destino: ${l.target||'Não informado.'}\nData: ${date(new Date(l.at).toISOString())}`);})});
  }
  if(i.data.name==='userinfo'||id==='own:lookup-submit'){
    const m=await owner.member(actor,opts.membro||form.target);
    return embedMessage('Informações do membro','Consulte os dados e selecione uma ação de moderação.',{fields:[info('Nome',m.name,true),info('Identificador',m.id,true),info('Entrada no servidor',date(m.joinedAt)),info('Cargos',m.roles.map(id=>'<@&'+id+'>').join(', ')||'Nenhum cargo adicional.'),info('Advertências privadas',m.warnings.length,true),info('Restrição temporária',m.timeoutUntil?date(m.timeoutUntil):'Não aplicada.',true)],components:[row(['warn','timeout','kick','ban'].map(k=>button(actionNames[k],'own:'+k+':'+m.id,k==='ban'||k==='kick'?4:2)))]});
  }
  if(i.data.name==='warn'||id.startsWith('own:prepare:')){
    const parts=id.split(':');
    const p=await owner.prepare(actor,i.data.name==='warn'?{kind:'warn',target:opts.membro,reason:opts.motivo}:{kind:parts[2],target:parts[3],reason:form.reason,minutes:form.minutes});
    return embedMessage('Confirmação de moderação','Nenhuma ação foi aplicada. Confira os dados antes de confirmar. Esta solicitação expira em 5 minutos.',{fields:[info('Ação',actionNames[p.kind]),info('Membro',`${p.name} (${p.target})`),info('Motivo',p.reason),...(p.kind==='timeout'?[info('Duração',p.minutes?`${p.minutes} ${p.minutes===1?'minuto':'minutos'}.`:'Remover a restrição temporária.')]:[])],components:[row([button('Confirmar','own:confirm:'+p.id,4),button('Cancelar','own:cancel:'+p.id)])]});
  }
  if(id.startsWith('own:confirm:')){const result=await owner.confirm(actor,id.slice(12));return embedMessage(result.status==='applied'?'Ação concluída':'Ação não confirmada',result.message,{color:result.status==='applied'?CPX_GREEN:CPX_RED});}
  if(id.startsWith('own:cancel:'))return embedMessage('Solicitação cancelada',owner.cancel(actor,id.slice(11)).message);
  fail('Controle não encontrado. Use /guardian.');
}
