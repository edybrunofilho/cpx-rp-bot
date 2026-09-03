import {randomUUID} from 'node:crypto';
import {discord} from './bot.mjs';
import {embedMessage,CPX_GOLD,CPX_GREEN,CPX_RED} from './embeds.mjs';
import {fail} from '../lib/cpx/engine.mjs';

const ADMINISTRATOR=8n;
const MANAGE_CHANNELS=16n;
const VIEW_CHANNEL=1024n;
const SEND_MESSAGES=2048n;
const MANAGE_MESSAGES=8192n;
const READ_MESSAGE_HISTORY=65536n;
export const SUPPORT_PANEL_CHANNEL_ID='1493474833546088499';

export const supportCommands=[{
  name:'ticketpainel',
  description:'Publicar a Central de Suporte com abertura de tickets privados',
  type:1,
  default_member_permissions:MANAGE_CHANNELS.toString(),
  options:[
    {type:7,name:'categoria',description:'Categoria onde os canais privados serão criados',required:true,channel_types:[4]},
    {type:8,name:'cargo_suporte',description:'Cargo da equipe que atenderá os tickets',required:true},
  ],
}];

export const isSupportInteraction=i=>i.data?.name==='ticketpainel'||String(i.data?.custom_id||'').startsWith('support:');
const TYPES={
  denuncia:{label:'Denúncias',emoji:'📣',description:'Denunciar jogadores, membros ou situações.'},
  duvida:{label:'Dúvidas',emoji:'❓',description:'Tirar dúvidas sobre o servidor e suas regras.'},
  recurso:{label:'Recurso de punição',emoji:'⚖️',description:'Solicitar a análise de uma punição recebida.'},
  geral:{label:'Suporte geral',emoji:'🤝',description:'Receber ajuda em outras situações.'},
};
const optionMap=i=>Object.fromEntries((i.data?.options||[]).map(option=>[option.name,option.value]));
const safeName=value=>String(value||'usuario').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'usuario';
const hasPermission=(i,permission)=>(BigInt(i.member?.permissions||0)&(ADMINISTRATOR|permission))!==0n;
const mention=id=>'<@'+id+'>';
const channelMention=id=>'<#'+id+'>';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const panelPayload=(categoryId,supportRoleId)=>embedMessage('Central de Suporte — Complexo Paulista','**Bem-vindo à Central de Suporte do Complexo Paulista!** 🤝\n\nEste espaço permite entrar em contato diretamente com nossa equipe e receber auxílio de maneira rápida, organizada e acolhedora. Escolha abaixo a categoria adequada para o seu atendimento.',{
  color:CPX_GOLD,
  fields:[
    {name:'📞 Tipos de atendimento',value:'Clique em **Escolher atendimento** e selecione a categoria que corresponde à sua necessidade. Um canal privado será criado para você e para a equipe responsável.'},
    {name:'📢 Importante',value:'• Selecione a categoria correta.\n• Explique sua situação com clareza.\n• Mantenha o respeito e trate a equipe com educação.\n• Não abra tickets duplicados ou desnecessários.\n• Após abrir o ticket, aguarde um membro da equipe assumir o atendimento. Evite marcações e cobranças repetidas.'},
    {name:'💛 Complexo Paulista',value:'Obrigado por confiar em nossa equipe. A Staff está disponível para prestar o suporte necessário.'},
  ],
  components:[{type:1,components:[{type:3,custom_id:'support:open:'+categoryId+':'+supportRoleId,placeholder:'Escolher atendimento',min_values:1,max_values:1,options:Object.entries(TYPES).map(([value,type])=>({label:type.label,value,description:type.description,emoji:{name:type.emoji}}))}]}],
  footer:'Complexo Paulista • Central de Suporte',
});

export function createSupportService(store,e,api=discord){
  store.db.exec(`CREATE TABLE IF NOT EXISTS support_tickets(
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL,
    support_role_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    claimed_by TEXT,
    created INTEGER NOT NULL,
    closed INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS support_one_open ON support_tickets(guild_id,owner_id) WHERE status='open';`);
  store.db.exec(`CREATE TABLE IF NOT EXISTS support_panels(
    channel_id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    support_role_id TEXT NOT NULL,
    updated INTEGER NOT NULL
  )`);
  const request=(path,options)=>api(path,e.DISCORD_BOT_TOKEN,options);
  function savePanel(channelId,messageId,categoryId,supportRoleId){
    store.db.prepare('INSERT INTO support_panels(channel_id,message_id,category_id,support_role_id,updated) VALUES(?,?,?,?,?) ON CONFLICT(channel_id) DO UPDATE SET message_id=excluded.message_id,category_id=excluded.category_id,support_role_id=excluded.support_role_id,updated=excluded.updated').run(channelId,messageId,categoryId,supportRoleId,Date.now());
  }

  async function postPanel(i){
    if(i.guild_id!==e.DISCORD_GUILD_ID)fail('O painel de suporte só pode ser publicado no servidor principal.',403);
    if(!hasPermission(i,MANAGE_CHANNELS))fail('Você precisa da permissão Gerenciar canais para publicar o painel.',403);
    const o=optionMap(i),category=i.data?.resolved?.channels?.[o.categoria],role=i.data?.resolved?.roles?.[o.cargo_suporte];
    if(!category||category.type!==4||category.guild_id&&category.guild_id!==i.guild_id)fail('Selecione uma categoria válida deste servidor.');
    if(!role||role.id===i.guild_id)fail('Selecione um cargo de suporte válido.');
    const payload=panelPayload(category.id,role.id);
    const message=await request('/channels/'+i.channel_id+'/messages',{method:'POST',body:JSON.stringify(payload)});
    savePanel(i.channel_id,message.id,category.id,role.id);
    return embedMessage('Painel de suporte publicado','A Central de Suporte foi publicada em '+channelMention(i.channel_id)+'.',{color:CPX_GREEN});
  }

  async function ensureAutomaticPanel(){
    const channel=await request('/channels/'+SUPPORT_PANEL_CHANNEL_ID);
    if(channel.guild_id!==e.DISCORD_GUILD_ID||![0,5].includes(channel.type))fail('O canal automático da Central de Suporte não pertence ao servidor principal ou não aceita mensagens.',503);
    const saved=store.db.prepare('SELECT * FROM support_panels WHERE channel_id=?').get(SUPPORT_PANEL_CHANNEL_ID);
    if(saved){
      try{await request('/channels/'+SUPPORT_PANEL_CHANNEL_ID+'/messages/'+saved.message_id);return false;}
      catch(error){if(error.status!==404)throw error;}
    }
    const [channels,roles]=await Promise.all([
      request('/guilds/'+e.DISCORD_GUILD_ID+'/channels'),
      request('/guilds/'+e.DISCORD_GUILD_ID+'/roles'),
    ]);
    let category=channels.find(item=>item.type===4&&item.id===saved?.category_id)
      ||channels.find(item=>item.type===4&&['atendimentos','suporte','tickets'].includes(normalize(item.name)));
    if(!category)category=await request('/guilds/'+e.DISCORD_GUILD_ID+'/channels',{method:'POST',body:JSON.stringify({name:'ATENDIMENTOS',type:4})});
    const configuredRole=String(e.DISCORD_SUPPORT_ROLE_ID||'');
    const supportRole=roles.find(role=>role.id===(saved?.support_role_id||configuredRole))
      ||roles.find(role=>['suporte','equipe de suporte','staff'].includes(normalize(role.name)))
      ||roles.find(role=>role.id===e.DISCORD_ADMIN_ROLE_ID);
    if(!supportRole)fail('Crie um cargo chamado Suporte ou configure DISCORD_SUPPORT_ROLE_ID.',503);
    const message=await request('/channels/'+SUPPORT_PANEL_CHANNEL_ID+'/messages',{method:'POST',body:JSON.stringify(panelPayload(category.id,supportRole.id))});
    savePanel(SUPPORT_PANEL_CHANNEL_ID,message.id,category.id,supportRole.id);
    return true;
  }

  async function openTicket(i){
    if(i.guild_id!==e.DISCORD_GUILD_ID)fail('Este painel não pertence ao servidor autorizado.',403);
    const match=/^support:open:(\d{17,22}):(\d{17,22})$/.exec(i.data.custom_id||'');if(!match)fail('Configuração do painel inválida.');
    const [,categoryId,supportRoleId]=match,kind=i.data.values?.[0],type=TYPES[kind];if(!type)fail('Categoria de atendimento inválida.');
    const ownerId=i.member.user.id;
    const existing=store.db.prepare("SELECT channel_id FROM support_tickets WHERE guild_id=? AND owner_id=? AND status='open'").get(i.guild_id,ownerId);
    if(existing){
      if(existing.channel_id.startsWith('pending:'))return embedMessage('Ticket em criação','Seu atendimento já está sendo criado. Aguarde alguns segundos.',{color:CPX_GOLD});
      try{await request('/channels/'+existing.channel_id);return embedMessage('Ticket já aberto','Você já possui um atendimento em '+channelMention(existing.channel_id)+'.',{color:CPX_GOLD});}
      catch(error){if(error.status!==404)throw error;store.db.prepare("UPDATE support_tickets SET status='closed',closed=? WHERE channel_id=?").run(Date.now(),existing.channel_id);}
    }
    const [category,roles,botUser]=await Promise.all([request('/channels/'+categoryId),request('/guilds/'+i.guild_id+'/roles'),request('/users/@me')]);
    if(category.type!==4||category.guild_id!==i.guild_id)fail('A categoria configurada não está mais disponível.',404);
    if(!roles.some(role=>role.id===supportRoleId))fail('O cargo de suporte configurado não existe mais.',404);
    const ticketId=randomUUID(),pendingChannel='pending:'+ticketId;
    const reserved=store.db.prepare('INSERT OR IGNORE INTO support_tickets(id,guild_id,channel_id,owner_id,support_role_id,category_id,kind,status,created) VALUES(?,?,?,?,?,?,?,?,?)').run(ticketId,i.guild_id,pendingChannel,ownerId,supportRoleId,categoryId,kind,'open',Date.now());
    if(!reserved.changes)return embedMessage('Ticket já aberto','Você já possui um atendimento aberto ou em criação.',{color:CPX_GOLD});
    let channel;
    try{channel=await request('/guilds/'+i.guild_id+'/channels',{method:'POST',body:JSON.stringify({
      name:'ticket-'+kind+'-'+safeName(i.member.user.global_name||i.member.user.username),
      type:0,parent_id:categoryId,
      topic:'Ticket '+type.label+' • Autor: '+ownerId,
      permission_overwrites:[
        {id:i.guild_id,type:0,allow:'0',deny:VIEW_CHANNEL.toString()},
        {id:ownerId,type:1,allow:(VIEW_CHANNEL|SEND_MESSAGES|READ_MESSAGE_HISTORY).toString(),deny:'0'},
        {id:supportRoleId,type:0,allow:(VIEW_CHANNEL|SEND_MESSAGES|READ_MESSAGE_HISTORY|MANAGE_MESSAGES).toString(),deny:'0'},
        {id:botUser.id,type:1,allow:(VIEW_CHANNEL|SEND_MESSAGES|READ_MESSAGE_HISTORY|MANAGE_CHANNELS|MANAGE_MESSAGES).toString(),deny:'0'},
      ],
    })});store.db.prepare('UPDATE support_tickets SET channel_id=? WHERE id=?').run(channel.id,ticketId);}
    catch(error){store.db.prepare('DELETE FROM support_tickets WHERE id=? AND channel_id=?').run(ticketId,pendingChannel);throw error;}
    const payload=embedMessage(type.emoji+' '+type.label,'Seu atendimento foi criado com sucesso. Explique sua situação com clareza e aguarde a equipe responsável.',{
      color:CPX_GREEN,
      fields:[
        {name:'Solicitante',value:mention(ownerId),inline:true},
        {name:'Categoria',value:type.label,inline:true},
        {name:'Status',value:'Aguardando atendimento',inline:true},
      ],
      components:[{type:1,components:[
        {type:2,style:1,label:'Assumir ticket',emoji:{name:'🙋'},custom_id:'support:claim:'+ticketId},
        {type:2,style:4,label:'Encerrar ticket',emoji:{name:'🔒'},custom_id:'support:close:'+ticketId},
      ]}],
      footer:'Complexo Paulista • Atendimento privado',
    });
    await request('/channels/'+channel.id+'/messages',{method:'POST',body:JSON.stringify({...payload,content:mention(ownerId)+' <@&'+supportRoleId+'>',allowed_mentions:{users:[ownerId],roles:[supportRoleId],parse:[]}})});
    return embedMessage('Ticket criado','Seu atendimento está disponível em '+channelMention(channel.id)+'.',{color:CPX_GREEN});
  }

  function ticketFor(i,id){
    const ticket=store.db.prepare('SELECT * FROM support_tickets WHERE id=? AND guild_id=?').get(id,i.guild_id);
    if(!ticket||ticket.channel_id!==i.channel_id)fail('Este ticket não foi encontrado.',404);
    if(ticket.status!=='open')fail('Este atendimento já foi encerrado.');
    return ticket;
  }
  const isStaff=(i,ticket)=>hasPermission(i,MANAGE_CHANNELS)||i.member.roles?.includes(ticket.support_role_id);

  async function claimTicket(i,id){
    const ticket=ticketFor(i,id);if(!isStaff(i,ticket))fail('Somente a equipe de suporte pode assumir este ticket.',403);
    if(ticket.claimed_by&&ticket.claimed_by!==i.member.user.id)fail('Este ticket já foi assumido por '+mention(ticket.claimed_by)+'.',409);
    store.db.prepare('UPDATE support_tickets SET claimed_by=? WHERE id=?').run(i.member.user.id,id);
    const payload=embedMessage('Atendimento assumido','Um membro da equipe assumiu este ticket.',{color:CPX_GREEN,fields:[{name:'Responsável',value:mention(i.member.user.id)}]});
    await request('/channels/'+ticket.channel_id+'/messages',{method:'POST',body:JSON.stringify(payload)});
    return embedMessage('Ticket assumido','Você agora é responsável por este atendimento.',{color:CPX_GREEN});
  }

  async function closeTicket(i,id){
    const ticket=ticketFor(i,id),actorId=i.member.user.id;
    if(actorId!==ticket.owner_id&&!isStaff(i,ticket))fail('Você não pode encerrar este ticket.',403);
    await request('/channels/'+ticket.channel_id+'/permissions/'+ticket.owner_id,{method:'PUT',body:JSON.stringify({type:1,allow:(VIEW_CHANNEL|READ_MESSAGE_HISTORY).toString(),deny:SEND_MESSAGES.toString()})});
    const channel=await request('/channels/'+ticket.channel_id);
    const closedName=('fechado-'+channel.name.replace(/^fechado-/,'')).slice(0,100);
    await request('/channels/'+ticket.channel_id,{method:'PATCH',body:JSON.stringify({name:closedName})});
    store.db.prepare("UPDATE support_tickets SET status='closed',closed=? WHERE id=?").run(Date.now(),id);
    const payload=embedMessage('Ticket encerrado','Este atendimento foi encerrado e permanece disponível para consulta da equipe.',{color:CPX_RED,fields:[{name:'Encerrado por',value:mention(actorId)}],timestamp:new Date().toISOString()});
    await request('/channels/'+ticket.channel_id+'/messages',{method:'POST',body:JSON.stringify(payload)});
    return embedMessage('Atendimento encerrado','O ticket foi fechado com sucesso.',{color:CPX_GREEN});
  }

  async function execute(i){
    if(i.data?.name==='ticketpainel')return postPanel(i);
    if(String(i.data?.custom_id||'').startsWith('support:open:'))return openTicket(i);
    const match=/^support:(claim|close):([a-f0-9-]{36})$/.exec(i.data?.custom_id||'');if(!match)fail('Ação de suporte inválida.');
    return match[1]==='claim'?claimTicket(i,match[2]):closeTicket(i,match[2]);
  }
  return {execute,ensureAutomaticPanel};
}
