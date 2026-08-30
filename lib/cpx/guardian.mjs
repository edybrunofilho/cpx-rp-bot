export const GUARDIAN_NAME='cpx guardian';
export const guardianCommands=[
 ['ajuda','Lista as funções disponíveis','Todos'],['saldo','Consulta seu saldo RP','Todos'],['extrato','Mostra as últimas movimentações','Todos'],['rg','Consulta seu RG de personagem','Todos'],['transferir','Transfere dinheiro com confirmação','Todos'],['avisos','Liga ou desliga as DMs financeiras','Todos'],['ticket abrir','Abre um atendimento privado','Todos'],['ticket listar','Lista seus atendimentos','Todos'],['ticket responder','Responde a um atendimento','Autor / administração'],['ticket fechar','Encerra seu atendimento','Autor / administração'],['perguntar','Ajuda contextual e IA opcional','Todos'],['ajustar','Adiciona ou retira dinheiro RP','Administrador'],['pagar','Paga usando um caixa institucional','Cargo do caixa'],['advertir','Registra uma advertência','Administrador'],['castigo','Aplica ou remove timeout','Administrador'],['comunicado','Publica um comunicado no Instaplexo','Cargo do canal'],['portal','Abre o portal da cidade','Todos'],['status','Mostra a disponibilidade do serviço','Todos']
];
export const guardianActions=['ticket_open','ticket_reply','ticket_close','warn','timeout'];
function problem(message,status=400){const e=new Error(message);e.status=status;throw e;}
function text(v,min,max){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)problem(`Use de ${min} a ${max} caracteres.`);return v.trim();}
export function ensureGuardian(state){state.tickets??=[];state.warnings??=[];state.moderation??=[];return state;}
export function guardianView(state,actor){ensureGuardian(state);const admin=actor.role==='admin';return {tickets:state.tickets.filter(t=>admin||t.ownerId===actor.id),warnings:state.warnings.filter(w=>admin||w.target===actor.id),moderation:state.moderation.filter(m=>admin||m.target===actor.id)};}
export function applyGuardian(state,actor,input){
 ensureGuardian(state);const me=state.players.find(p=>p.id===actor.id);if(!me)problem('Conta não encontrada.',401);const at=new Date().toISOString();
 if(input.action==='ticket_open'){
  if(state.tickets.filter(t=>t.ownerId===actor.id&&t.status==='open').length>=3)problem('Você já possui 3 tickets abertos.');
  if(state.tickets.length>=5000)problem('Limite de atendimentos atingido. Procure a administração.');
  state.tickets.unshift({id:crypto.randomUUID(),ownerId:actor.id,owner:me.name,subject:text(input.subject,3,80),status:'open',at,messages:[{id:crypto.randomUUID(),author:me.name,authorId:actor.id,text:text(input.text,3,1000),at}]});
 }else if(input.action==='ticket_reply'||input.action==='ticket_close'){
  const t=state.tickets.find(t=>t.id===input.id);if(!t)problem('Ticket não encontrado.',404);if(t.ownerId!==actor.id&&actor.role!=='admin')problem('Você não pode acessar este ticket.',403);if(t.status!=='open')problem('Este ticket já está encerrado.');
  if(input.action==='ticket_reply'){if(t.messages.length>=300)problem('Limite de respostas atingido.');t.messages.push({id:crypto.randomUUID(),author:me.name,authorId:actor.id,text:text(input.text,1,1000),at});}else{t.status='closed';t.closedBy=me.name;t.closedAt=at;}
 }else{
  if(actor.role!=='admin')problem('Somente administradores podem moderar.',403);
  if(!state.players.some(p=>p.id===input.target)||input.target===actor.id)problem('Selecione outro jogador cadastrado.');
  if(input.confirm!==true)problem('Confirme a ação antes de continuar.');
  const reason=text(input.reason,3,180);
  if(input.action==='warn'){state.warnings.unshift({id:crypto.randomUUID(),target:input.target,actor:me.name,actorId:actor.id,reason,at});}
  else if(input.action==='timeout'){
   const minutes=Number(input.minutes);if(!Number.isInteger(minutes)||minutes<0||minutes>1440)problem('Informe entre 0 e 1440 minutos. Zero remove o castigo.');
   if(state.moderation.some(m=>m.target===input.target&&['pending','processing'].includes(m.status)))problem('Já existe uma ação pendente para este jogador.');
   state.moderation.unshift({id:crypto.randomUUID(),target:input.target,actor:me.name,actorId:actor.id,reason,minutes,at,until:minutes?new Date(Date.now()+minutes*60000).toISOString():null,status:actor.demo?'demo':'pending'});
  }else problem('Ação inválida.');
 }
 return {state,events:[]};
}
export const knowledge='O cpx guardian atende o CPX ROLEPLAY. Dinheiro e RG são fictícios. Saldo, RG, extrato e avisos são privados. Transferências exigem motivo e confirmação. Administração ajusta saldos; prefeito usa caixa municipal; governo usa tesouro estadual. Tickets são privados para o autor e administradores. Canais oficiais do Instaplexo exigem o cargo correspondente. A IA só explica: nunca executa pagamentos, muda cargos ou aplica punições. As regras de conduta específicas são definidas pela administração do servidor; não invente regras.';
export function contextualAnswer(question,view){
 const q=String(question).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const cash=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((n||0)/100);
 if(/saldo|quanto.*dinheiro/.test(q))return `Seu saldo disponível é ${cash(view.me?.balance)} em dinheiro RP. Consulte Meu banco ou /cpx saldo. Valores de terceiros não são exibidos aqui.`;
 if(/transfer|pagar|pagamento|adicionar.*dinheiro/.test(q))return 'No Meu banco, escolha Transferir, selecione o jogador e informe valor e motivo. Confirme os dados. Ajustes exigem administrador; pagamentos institucionais exigem o cargo do caixa. Eu não faço movimentações pela conversa.';
 if(/\brg\b|identidade|documento|foto/.test(q))return `Seu registro é ${view.me?.rg||'consultável em Meu RG'}. Edite nome, profissão e nascimento do personagem em Meu RG. Use foto PNG/JPG/WebP de até 2 MB. Nunca envie documentos pessoais reais.`;
 if(/ticket|suporte|atendimento|denuncia/.test(q))return 'Abra a aba Atendimento ou use /cpx ticket abrir. Somente você e administradores veem o conteúdo. Evite senhas, tokens e dados pessoais; você pode acompanhar respostas e encerrar o ticket.';
 if(/cargo|permiss|prefeit|governo|admin/.test(q))return 'O acesso real vem dos cargos configurados no Discord. Prefeito usa a Prefeitura; Governo usa o tesouro estadual; Administrador gerencia saldos e moderação. Não altero cargos. Peça à administração para verificar sua permissão.';
 if(/aviso|notifica|\bdm\b/.test(q))return 'Ative os avisos em Conexão Discord ou /cpx avisos. As DMs dependem de sua preferência e das permissões do Discord. Uma DM bloqueada não desfaz uma transação.';
 if(/regra|ban|punic|castigo|advert/.test(q))return 'As regras específicas precisam ser confirmadas com a administração. Advertências são registradas no portal; castigos exigem confirmação e permissões de moderação. A inteligência artificial não aplica punições.';
 if(/oi\b|ola\b|ajuda|func/.test(q))return 'Sou o cpx guardian. Posso ajudar com banco, RG, cargos, avisos e atendimento. Veja a aba Comandos para todas as funções. Pergunte, por exemplo: “como abrir um ticket?”';
 return null;
}

