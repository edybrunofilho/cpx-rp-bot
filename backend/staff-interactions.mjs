import {discord} from './bot.mjs';
import {embedMessage,CPX_GREEN,CPX_RED} from './embeds.mjs';
import {fail} from '../lib/cpx/engine.mjs';

export const STAFF_GUILD_ID='1494169652342030336';
const ADMINISTRATOR=8n;
const MANAGE_NICKNAMES=1n<<27n;
const MANAGE_ROLES=1n<<28n;
const MODERATE_MEMBERS=1n<<40n;
const KICK_MEMBERS=2n;
const BAN_MEMBERS=4n;

const user={type:6,name:'membro',description:'Membro do servidor',required:true};
const role={type:8,name:'cargo',description:'Cargo que será adicionado ou removido',required:true};
const reason={type:3,name:'motivo',description:'Motivo do registro',required:true,min_length:3,max_length:300};
const confirm={type:5,name:'confirmar',description:'Confirme após revisar todos os dados',required:true};
const text=(name,description,extra={})=>({type:3,name,description,required:true,...extra});
const sub=(name,description,options)=>({type:1,name,description,options});

export const staffCommands=[
  {name:'staff',description:'Administração da equipe no servidor de staff',type:1,default_member_permissions:'8',options:[
    sub('promocao','Adicionar um cargo a um membro da staff',[user,role,reason,confirm]),
    sub('rebaixar','Remover um cargo de um membro da staff',[user,role,reason,confirm]),
    sub('advertencia','Registrar uma advertência para um membro da staff',[user,reason,confirm]),
    sub('apelido','Alterar o apelido de um membro da staff',[user,text('apelido','Novo apelido do membro',{min_length:1,max_length:32}),reason,confirm]),
    sub('ausencia','Registrar a ausência de um membro da staff',[user,text('inicio','Data inicial, exemplo: 29/08/2026',{min_length:8,max_length:10}),text('fim','Data final, exemplo: 31/08/2026',{min_length:8,max_length:10}),reason,confirm]),
  ]},
  {name:'player',description:'Punições administrativas de jogadores',type:1,default_member_permissions:'8',options:[
    sub('punicao','Aplicar e registrar uma punição',[user,text('tipo','Tipo de punição',{choices:[{name:'Advertência',value:'warning'},{name:'Mute',value:'timeout'},{name:'Expulsão',value:'kick'},{name:'Banimento',value:'ban'}]}),reason,confirm,{type:4,name:'minutos',description:'Duração do mute; obrigatório apenas para mute',required:false,min_value:1,max_value:40320}]),
  ]},
];

export const isStaffCommand=i=>['staff','player'].includes(i.data?.name);
const optionMap=i=>{
  const subcommand=i.data.options?.[0];
  return {subcommand:subcommand?.name,values:Object.fromEntries((subcommand?.options||[]).map(o=>[o.name,o.value]))};
};
const has=(bits,permission)=>(bits&(ADMINISTRATOR|permission))!==0n;
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const highest=(member,roles)=>Math.max(0,...roles.filter(r=>member.roles.includes(r.id)).map(r=>r.position));
const display=member=>member.nick||member.user.global_name||member.user.username;
const mention=id=>'<@'+id+'>';
const channelMention=id=>'<#'+id+'>';
function effective(member,roles,guild,channel){
  let bits=roles.filter(r=>r.id===guild.id||member.roles.includes(r.id)).reduce((value,r)=>value|BigInt(r.permissions),0n);
  if(member.user.id===guild.owner_id||(bits&ADMINISTRATOR)!==0n)return 1024n|2048n|16384n;
  const overwrites=channel.permission_overwrites||[];
  const everyone=overwrites.find(o=>o.type===0&&o.id===guild.id);
  if(everyone)bits=(bits&~BigInt(everyone.deny))|BigInt(everyone.allow);
  let deny=0n,allow=0n;
  for(const overwrite of overwrites.filter(o=>o.type===0&&member.roles.includes(o.id))){deny|=BigInt(overwrite.deny);allow|=BigInt(overwrite.allow);}
  bits=(bits&~deny)|allow;
  const personal=overwrites.find(o=>o.type===1&&o.id===member.user.id);
  if(personal)bits=(bits&~BigInt(personal.deny))|BigInt(personal.allow);
  return bits;
}
function brazilianDate(value){
  const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value||'');if(!match)return null;
  const date=new Date(Date.UTC(Number(match[3]),Number(match[2])-1,Number(match[1])));
  return date.getUTCFullYear()===Number(match[3])&&date.getUTCMonth()===Number(match[2])-1&&date.getUTCDate()===Number(match[1])?date:null;
}

export function createStaffService(e,api=discord){
  const request=(path,options)=>api(path,e.DISCORD_BOT_TOKEN,options);
  async function context(i,targetId,permission,needsReport=false){
    if(i.guild_id!==STAFF_GUILD_ID)fail('Este comando está disponível somente no servidor autorizado.',403);
    const actorBits=BigInt(i.member?.permissions||0);
    if(!has(actorBits,permission))fail('Você não possui permissão para utilizar esta função.',403);
    const root='/guilds/'+STAFF_GUILD_ID;
    const [guild,roles,target,botUser,channels]=await Promise.all([
      request(root),request(root+'/roles'),request(root+'/members/'+targetId),request('/users/@me'),needsReport?request(root+'/channels'):Promise.resolve([]),
    ]);
    const bot=await request(root+'/members/'+botUser.id);
    let channel=null;
    if(needsReport){
      const configured=String(e.STAFF_PUNISHMENTS_CHANNEL_ID||'');
      const candidates=channels.filter(c=>[0,5].includes(c.type)&&(configured?c.id===configured:normalize(c.name).endsWith('punicoes')));
      if(candidates.length!==1)fail(configured?'O canal configurado para punições é inválido.':'Crie apenas um canal de texto chamado “punições” ou configure STAFF_PUNISHMENTS_CHANNEL_ID.',503);
      channel=candidates[0];
      if((effective(bot,roles,guild,channel)&(1024n|2048n|16384n))!==(1024n|2048n|16384n))fail('O bot precisa ver o canal de punições, enviar mensagens e inserir links.',403);
    }
    if(target.user.id===guild.owner_id||target.user.bot)fail('Este membro está protegido contra esta ação.',403);
    if(i.member.user.id!==guild.owner_id&&highest(i.member,roles)<=highest(target,roles))fail('A hierarquia de cargos impede esta ação.',403);
    if(highest(bot,roles)<=highest(target,roles))fail('Coloque o cargo do bot acima do cargo do membro.',403);
    return {guild,roles,target,bot,channel};
  }
  async function report(channel,title,fields,color=CPX_GREEN){
    const payload=embedMessage(title,'Registro automático do painel administrativo.',{color,timestamp:new Date().toISOString(),fields});
    try{await request('/channels/'+channel.id+'/messages',{method:'POST',body:JSON.stringify(payload)});return true;}catch{return false;}
  }
  async function execute(i){
    if(!isStaffCommand(i))fail('Comando administrativo não reconhecido.');
    const {subcommand,values:o}=optionMap(i);
    if(o.confirmar!==true)fail('Nenhuma ação foi realizada. Revise os dados e marque confirmar.',400);
    const actorId=i.member.user.id,targetId=o.membro;
    if(!/^\d{17,22}$/.test(targetId||'')||targetId===actorId)fail('Selecione outro membro válido.');
    const action=i.data.name==='player'?'punicao':subcommand;
    const punishmentPermission={warning:MODERATE_MEMBERS,timeout:MODERATE_MEMBERS,kick:KICK_MEMBERS,ban:BAN_MEMBERS}[o.tipo];
    const required={promocao:MANAGE_ROLES,rebaixar:MANAGE_ROLES,advertencia:MODERATE_MEMBERS,apelido:MANAGE_NICKNAMES,ausencia:MODERATE_MEMBERS,punicao:punishmentPermission}[action];
    if(!required)fail('Opção administrativa inválida.');
    const reportable=action==='advertencia'||action==='punicao';
    const ctx=await context(i,targetId,required,reportable);
    const base='/guilds/'+STAFF_GUILD_ID;
    let title,summary,extra=[];
    if(action==='promocao'||action==='rebaixar'){
      const selected=ctx.roles.find(r=>r.id===o.cargo);
      if(!selected||selected.id===ctx.guild.id||selected.managed)fail('Selecione um cargo comum e gerenciável.');
      if(selected.position>=highest(ctx.bot,ctx.roles))fail('O cargo do bot precisa ficar acima do cargo selecionado.',403);
      if(actorId!==ctx.guild.owner_id&&selected.position>=highest(i.member,ctx.roles))fail('Você não pode gerenciar um cargo igual ou superior ao seu.',403);
      await request(base+'/members/'+targetId+'/roles/'+selected.id,{method:action==='promocao'?'PUT':'DELETE',headers:{'X-Audit-Log-Reason':encodeURIComponent(('CPX staff | '+actorId+' | '+o.motivo).slice(0,300))}});
      title=action==='promocao'?'Promoção de staff':'Rebaixamento de staff';
      summary=action==='promocao'?'Cargo adicionado com sucesso.':'Cargo removido com sucesso.';
      extra.push({name:'Cargo',value:'<@&'+selected.id+'>',inline:true});
    }else if(action==='apelido'){
      await request(base+'/members/'+targetId,{method:'PATCH',headers:{'X-Audit-Log-Reason':encodeURIComponent(('CPX staff | '+actorId+' | '+o.motivo).slice(0,300))},body:JSON.stringify({nick:o.apelido})});
      title='Alteração de apelido da staff';summary='Apelido alterado com sucesso.';extra.push({name:'Novo apelido',value:o.apelido});
    }else if(action==='advertencia'){
      title='Advertência de staff';summary='Advertência registrada.';
    }else if(action==='ausencia'){
      const start=brazilianDate(o.inicio),end=brazilianDate(o.fim);
      if(!start||!end||end<start)fail('Informe datas válidas no formato DD/MM/AAAA, com a data final igual ou posterior à inicial.');
      title='Ausência de staff';summary='Ausência registrada.';extra.push({name:'Período',value:o.inicio+' até '+o.fim});
    }else{
      const type=o.tipo;
      if(!['warning','timeout','kick','ban'].includes(type))fail('Tipo de punição inválido.');
      if(type==='timeout'){
        const minutes=Number(o.minutos);if(!Number.isInteger(minutes)||minutes<1||minutes>40320)fail('Informe de 1 a 40320 minutos para o timeout.');
        await request(base+'/members/'+targetId,{method:'PATCH',headers:{'X-Audit-Log-Reason':encodeURIComponent(('CPX player | '+actorId+' | '+o.motivo).slice(0,300))},body:JSON.stringify({communication_disabled_until:new Date(Date.now()+minutes*60000).toISOString()})});
        extra.push({name:'Duração',value:minutes+' minutos',inline:true});
      }
      if(type==='kick')await request(base+'/members/'+targetId,{method:'DELETE',headers:{'X-Audit-Log-Reason':encodeURIComponent(('CPX player | '+actorId+' | '+o.motivo).slice(0,300))}});
      if(type==='ban')await request(base+'/bans/'+targetId,{method:'PUT',headers:{'X-Audit-Log-Reason':encodeURIComponent(('CPX player | '+actorId+' | '+o.motivo).slice(0,300))},body:JSON.stringify({delete_message_seconds:0})});
      title={warning:'Advertência de player',timeout:'Mute de player',kick:'Expulsão de player',ban:'Banimento de player'}[type];
      summary=type==='warning'?'Advertência registrada.':'Punição aplicada com sucesso.';
    }
    const fields=[{name:'Membro',value:mention(targetId)+'\n'+display(ctx.target),inline:true},{name:'Responsável',value:mention(actorId),inline:true},...extra,{name:'Motivo',value:o.motivo}];
    if(!reportable)return embedMessage(title,summary,{color:CPX_GREEN,fields});
    const sent=await report(ctx.channel,title,fields,CPX_RED);
    return embedMessage(title,summary+(sent?' O relatório disciplinar foi enviado automaticamente em '+channelMention(ctx.channel.id)+'.':' A ação foi concluída, mas o relatório não pôde ser enviado; não repita a ação antes de conferir o canal.'),{color:sent?CPX_GREEN:CPX_RED,fields});
  }
  return {execute};
}
