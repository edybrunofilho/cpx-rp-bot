import {requireOwner} from './owner-service.mjs';
import {fail} from '../lib/cpx/engine.mjs';
import {embedMessage,announcementMessage,CPX_GREEN,CPX_RED} from './embeds.mjs';
import {SSU_CHANNEL_ID,SSU_DEFAULTS,ssuMessage} from './ssu.mjs';

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
function ssuModal(draft=SSU_DEFAULTS,replaceId=''){
  const input=(id,label,value,max,style=1)=>row([{type:4,custom_id:id,label,value:String(value),style,required:true,max_length:max}]);
  return {type:9,data:{custom_id:'own:ssu-submit'+(replaceId?':'+replaceId:''),title:'Editar votação SSU',components:[
    ...draft.times.map((time,index)=>input('time'+(index+1),'Horário '+(index+1)+' (HH:MM)',time,5)),
    input('message','Mensagem: use {h1}, {h2} e {h3}',draft.message,1500,2),
    input('duration','Duração da votação (1 a 768 horas)',draft.duration,3),
  ]}};
}
export function ownerImmediate(i,owner=null){
  if(i.type!==3)return null;
  requireOwner({id:i.member?.user?.id});
  const id=i.data.custom_id;
  if(id==='own:ssu')return ssuModal();
  if(id.startsWith('own:ssu-edit:')){
    if(!owner)fail('Painel indisponível.',503);
    const draftId=id.slice('own:ssu-edit:'.length);
    return ssuModal(owner.ssuDraft({id:i.member.user.id},draftId),draftId);
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
  return embedMessage('Painel de controle','Acesso exclusivo à conta **joaodayz.**\nSelecione uma opção abaixo. Anúncios, votações e ações de moderação exigem revisão e confirmação.',{fields:[info('Membros e moderação','Consulte membros e aplique advertências, restrições temporárias, expulsões ou banimentos.'),info('Anúncios','Revise o comunicado antes de publicá-lo no canal oficial com a menção @everyone.'),info('Votação SSU','Edite a mensagem e os três horários antes de abrir uma enquete com uma escolha por pessoa.')],components:[row([button('Membros e moderação','own:lookup'),button('Postar anúncio','own:announcement'),button('Registros','own:logs')]),row([button('Enviar votação SSU','own:ssu',1),button('Configurações','own:config'),{type:2,style:5,label:'Painel web',url:origin+'/owner'}])]});
}
export async function executeOwnerInteraction(i,owner,e){
  const actor={id:i.member?.user?.id};requireOwner(actor);
  if(i.guild_id!==e.DISCORD_GUILD_ID||i.application_id!==e.DISCORD_CLIENT_ID)fail('Servidor inválido.',403);
  const opts=Object.fromEntries((i.data.options||[]).map(o=>[o.name,o.value]));
  const id=i.data.custom_id||'',form=values(i);
  if(['guardian','cpxpainel'].includes(i.data.name))return ownerMenu(e.PUBLIC_ORIGIN);
  if(id==='own:ssu-submit'||id.startsWith('own:ssu-submit:')){
    const p=await owner.prepare(actor,{kind:'ssu',times:[form.time1,form.time2,form.time3],message:form.message,duration:form.duration,...(id.startsWith('own:ssu-submit:')?{replaceId:id.slice('own:ssu-submit:'.length)}:{})});
    const preview=embedMessage('Revisão da votação SSU','Confira a mensagem e os horários. Nada foi publicado. Esta confirmação expira em 5 minutos.',{fields:[info('Canal',`#${p.name} (${SSU_CHANNEL_ID})`),info('Horários',p.ssu.times.join(' • ')),info('Duração',`${p.ssu.duration} ${p.ssu.duration===1?'hora':'horas'}. Uma escolha por pessoa.`),info('Convocação','A publicação mencionará @everyone. Esta prévia não notifica ninguém.')],components:[row([button('Publicar votação','own:confirm:'+p.id,4),button('Editar mensagem e horários','own:ssu-edit:'+p.id),button('Cancelar','own:cancel:'+p.id)])]});
    preview.embeds.push(...ssuMessage(p.ssu).embeds);
    return preview;
  }
  if(id==='own:config'){const c=owner.config(actor);return embedMessage('Configurações do cpx guardian','Os dados sensíveis não são exibidos neste painel. O canal de anúncios é definido no código; os demais identificadores são configurados nas variáveis privadas da hospedagem.',{fields:[info('Servidor',c.guildId,true),info('Conta autorizada',c.ownerId,true),info('Canal de anúncios',c.announcementChannelId),info('Cargo da administração',c.roles.admin||'Não configurado.',true),info('Cargo do prefeito',c.roles.mayor||'Não configurado.',true),info('Cargo do governo',c.roles.government||'Não configurado.',true),info('Portal',c.portal)]});}
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
