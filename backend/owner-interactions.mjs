import {requireOwner} from './owner-service.mjs';
import {fail} from '../lib/cpx/engine.mjs';

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
export function ownerImmediate(i){
  if(i.type!==3)return null;
  requireOwner({id:i.member?.user?.id});
  const id=i.data.custom_id;
  if(id==='own:announcement')return {type:9,data:{custom_id:'own:announcement-submit',title:'Revisar anúncio',components:[row([{type:4,custom_id:'text',label:'Texto do anúncio',style:2,required:true,min_length:3,max_length:1800}])]}};
  if(id==='own:lookup')return {type:9,data:{custom_id:'own:lookup-submit',title:'Consultar membro',components:[field('target','ID numérico do membro',22)]}};
  const match=/^own:(warn|timeout|kick|ban):(\d{17,22})$/.exec(id);
  if(!match)return null;
  const components=[field('reason','Motivo (mínimo 3 caracteres)')];
  if(match[1]==='timeout')components.push(field('minutes','Minutos: 0 remove, máximo 1440',4));
  return {type:9,data:{custom_id:'own:prepare:'+match[1]+':'+match[2],title:'Revisar '+match[1],components}};
}
export function ownerMenu(origin){
  return {content:'**cpx guardian · painel de controle**\nSomente joaodayz. pode usar estes controles. Anúncios e punições exigem revisão e confirmação.\nConsulte um membro para acessar Warn, Timeout, Kick e Ban.',components:[row([button('Membros e moderação','own:lookup'),button('Postar anúncio','own:announcement'),button('Logs','own:logs')]),row([button('Configurações','own:config'),{type:2,style:5,label:'Painel web',url:origin+'/owner'}])]};
}
export async function executeOwnerInteraction(i,owner,e){
  const actor={id:i.member?.user?.id};requireOwner(actor);
  if(i.guild_id!==e.DISCORD_GUILD_ID||i.application_id!==e.DISCORD_CLIENT_ID)fail('Servidor inválido.',403);
  const opts=Object.fromEntries((i.data.options||[]).map(o=>[o.name,o.value]));
  const id=i.data.custom_id||'',form=values(i);
  if(['guardian','cpxpainel'].includes(i.data.name))return ownerMenu(e.PUBLIC_ORIGIN);
  if(id==='own:config'){const c=owner.config(actor);return {content:'**Configurações do cpx guardian**\nServidor: '+c.guildId+'\nConta autorizada: '+c.ownerId+'\nCanal de anúncios: '+(c.announcementChannelId||'não configurado')+'\nCargo admin: '+(c.roles.admin||'não configurado')+'\nPrefeito: '+(c.roles.mayor||'não configurado')+'\nGoverno: '+(c.roles.government||'não configurado')+'\nPortal: '+c.portal+'\nAltere estes IDs nas variáveis privadas da hospedagem. Tokens nunca são exibidos aqui.',components:[]};}
  if(id==='own:announcement-submit'){
    const p=await owner.prepare(actor,{kind:'announcement',reason:form.text});
    return {content:`**Revisar anúncio para #${p.name} (${p.target})**\nPublicar? Sem notificações @everyone ou @here. Confirmação válida por 5 minutos.`,embeds:[{title:'Prévia do anúncio',description:p.reason,color:14927142}],components:[row([button('Publicar anúncio','own:confirm:'+p.id,4),button('Cancelar','own:cancel:'+p.id)])]};
  }
  if(id==='own:logs'){
    const data=owner.state(actor);
    return {content:'**Últimos registros do painel privado**\n'+(data.logs.slice(0,8).map(l=>l.action+' · '+l.target+' · '+new Date(l.at).toISOString()).join('\n')||'Nenhum registro.'),components:[]};
  }
  if(i.data.name==='userinfo'||id==='own:lookup-submit'){
    const m=await owner.member(actor,opts.membro||form.target);
    return {content:`**Membro: ${m.name}**\nID: ${m.id}\nEntrada: ${m.joinedAt}\nCargos: ${m.roles.join(', ')||'nenhum'}\nAdvertências privadas: ${m.warnings.length}\nTimeout até: ${m.timeoutUntil||'não aplicado'}`.slice(0,1800),components:[row(['warn','timeout','kick','ban'].map(k=>button(k,'own:'+k+':'+m.id,k==='ban'||k==='kick'?4:2)))]};
  }
  if(i.data.name==='warn'||id.startsWith('own:prepare:')){
    const parts=id.split(':');
    const p=await owner.prepare(actor,i.data.name==='warn'?{kind:'warn',target:opts.membro,reason:opts.motivo}:{kind:parts[2],target:parts[3],reason:form.reason,minutes:form.minutes});
    return {content:`**Confirme a ação: ${p.kind}**\nMembro: ${p.name} (${p.target})\nMotivo: ${p.reason}\n${p.kind==='timeout'?'Minutos: '+p.minutes+'\n':''}Expira em 5 minutos. Nada foi aplicado ainda.`,components:[row([button('Confirmar','own:confirm:'+p.id,4),button('Cancelar','own:cancel:'+p.id)])]};
  }
  if(id.startsWith('own:confirm:'))return {content:(await owner.confirm(actor,id.slice(12))).message,components:[]};
  if(id.startsWith('own:cancel:'))return {content:owner.cancel(actor,id.slice(11)).message,components:[]};
  fail('Controle não encontrado. Use /guardian.');
}
