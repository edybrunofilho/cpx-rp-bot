import {guardianActions,applyGuardian,guardianView} from './guardian.mjs';
export const roleNames = { citizen:'Cidadão', admin:'Administrador', mayor:'Prefeito', government:'Governo' };
export const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
export function initialState(demo=false){
  const state={players:[],treasuries:{city:0,state:0},transactions:[],posts:[]};
  if(!demo) return state;
  state.players=[{id:'demo-joao',name:'João Gabriel',handle:'cidadao.demo',balance:2450000,rg:'CPX-0001',birth:'2000-01-01',job:'Empreendedor',photo:'',notifications:true},{id:'demo-lucas',name:'Lucas Almeida',handle:'lucas.demo',balance:830000,rg:'CPX-0002',birth:'2000-05-14',job:'Mecânico',photo:'',notifications:true},{id:'demo-marina',name:'Marina Santos',handle:'marina.demo',balance:1725000,rg:'CPX-0003',birth:'2000-10-20',job:'Médica',photo:'',notifications:false}];
  state.treasuries={city:25000000,state:75000000};
  const time='2026-08-27T12:00:00.000Z';
  state.transactions=[{id:'example-1',from:'city',to:'demo-joao',amount:250000,reason:'Pagamento de serviço • exemplo',actor:'Prefeitura',at:time,dm:'Demonstração'},{id:'example-2',from:'demo-joao',to:'demo-lucas',amount:75000,reason:'Manutenção do veículo • exemplo',actor:'João Gabriel',at:time,dm:'Demonstração'}];
  state.posts=[{id:'welcome',author:'Prefeitura CPX',channel:'prefeitura',text:'A cidade começa com você. Emita seu RG, organize sua conta e acompanhe os comunicados por aqui.',at:time,likes:[],comments:[],example:true},{id:'bank',author:'Banco CPX',channel:'banco',text:'Seu dinheiro RP, sempre por perto. Transferências e movimentações ficam registradas no extrato.',at:time,likes:[],comments:[],example:true}];
  return state;
}
export function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
export function amountOf(value){const s=String(value??'');if(!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(s))fail('Informe um valor positivo com até duas casas decimais.');const [a,b='']=s.replace(',','.').split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<=0||n>10000000000)fail('Valor fora do limite permitido.');return n;}
export function textOf(v,min,max,label){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)fail(`${label}: use de ${min} a ${max} caracteres.`);return v.trim();}
export function canTreasury(role,key){return role==='admin'||(key==='city'&&role==='mayor')||(key==='state'&&role==='government');}
export function allowedChannels(role){return ['comunidade',...(role==='admin'?['prefeitura','administracao','banco','governo']:role==='mayor'?['prefeitura']:role==='government'?['governo']:[])];}
export function applyAction(state,actor,input){
 const a=input.action;const me=state.players.find(p=>p.id===actor.id);if(!me&&a!=='scheduled_credit')fail('Entre na sua conta para continuar.',401);
 if(guardianActions.includes(input.action))return applyGuardian(state,actor,input);
 const events=[];
 if(a==='transfer'||a==='bank_transfer'||a==='adjust'||a==='treasury'||a==='scheduled_credit'){
  const amount=amountOf(input.amount);const reason=textOf(input.reason,3,180,'Motivo');let from,to;
  if(a==='transfer'){from=me.id;to=input.target;if(to===me.id)fail('Escolha outro jogador.');}
  if(a==='bank_transfer'){if(actor.role!=='admin')fail('Apenas administradores podem transferir entre contas.',403);from=input.source;to=input.target;}
  if(a==='adjust'){if(actor.role!=='admin')fail('Apenas administradores podem ajustar saldos.',403);if(!['credit','debit'].includes(input.operation))fail('Operação inválida.');from=input.operation==='credit'?'system':input.target;to=input.operation==='credit'?input.target:'system';}
  if(a==='treasury'){if(!['city','state'].includes(input.treasury)||!canTreasury(actor.role,input.treasury))fail('Você não tem acesso a este caixa.',403);from=input.treasury;to=input.target;}
  if(a==='scheduled_credit'){if(actor.role!=='system')fail('Operação automática não autorizada.',403);from='system';to=input.target;}
  const valid=k=>k==='system'||k==='city'||k==='state'||state.players.some(p=>p.id===k);
  if(!valid(from)||!valid(to)||from===to)fail('Conta de destino inválida.');
  if(a==='transfer'&&['city','state','system'].includes(to))fail('Selecione um jogador.');
  if(a==='bank_transfer'&&(['city','state','system'].includes(from)||['city','state','system'].includes(to)))fail('Selecione duas contas de jogadores.');
  if(a==='treasury'&&(!state.players.some(p=>p.id===to)))fail('Selecione um jogador.');
  if(a==='adjust'&&(from==='system'&&to==='system'))fail('Conta inválida.');
  const get=k=>['city','state'].includes(k)?state.treasuries[k]:state.players.find(p=>p.id===k).balance;
  const set=(k,n)=>{if(k==='system')return;if(['city','state'].includes(k))state.treasuries[k]=n;else state.players.find(p=>p.id===k).balance=n;};
  if(from!=='system'&&get(from)<amount)fail('Saldo insuficiente. Nenhum valor foi movimentado.');
  if(to!=='system'&&get(to)+amount>Number.MAX_SAFE_INTEGER)fail('Limite de saldo atingido.');
  if(from!=='system')set(from,get(from)-amount);if(to!=='system')set(to,get(to)+amount);
  const tx={id:crypto.randomUUID(),requestId:input.requestId,from,to,amount,reason,actor:me?.name||'cpx guardian',at:new Date().toISOString(),dm:actor.demo?'Demonstração':'Na fila'};state.transactions.unshift(tx);events.push(tx);
 }else if(a==='profile'){
  me.name=textOf(input.name,3,60,'Nome do personagem');me.job=textOf(input.job,2,60,'Profissão');
  const date=String(input.birth??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toISOString().slice(0,10)||date<'1900-01-01')fail('Data de nascimento do personagem inválida.');me.birth=date;
 }else if(a==='notify'){if(typeof input.enabled!=='boolean')fail('Preferência inválida.');me.notifications=input.enabled;
 }else if(a==='post'){
  if(!allowedChannels(actor.role).includes(input.channel))fail('Você não pode publicar neste canal oficial.',403);
  const text=textOf(input.text,3,1200,'Publicação');state.posts.unshift({id:crypto.randomUUID(),author:me.name,authorId:me.id,channel:input.channel,text,at:new Date().toISOString(),likes:[],comments:[]});
 }else if(a==='like'){
  const p=state.posts.find(p=>p.id===input.id);if(!p)fail('Publicação não encontrada.',404);p.likes=p.likes.includes(me.id)?p.likes.filter(id=>id!==me.id):[...p.likes,me.id];
 }else if(a==='comment'){
  const p=state.posts.find(p=>p.id===input.id);if(!p)fail('Publicação não encontrada.',404);p.comments.push({id:crypto.randomUUID(),author:me.name,text:textOf(input.text,1,300,'Comentário'),at:new Date().toISOString()});
 }else fail('Ação inválida.');
 return {state,events};
}
export function viewState(state,actor){
 const me=state.players.find(p=>p.id===actor.id);const privileged=actor.role==='admin';
 return {...state,...guardianView(state,actor),players:state.players.map(p=>p.id===actor.id||privileged?p:{id:p.id,name:p.name,rg:p.rg}),treasuries:{city:canTreasury(actor.role,'city')?state.treasuries.city:null,state:canTreasury(actor.role,'state')?state.treasuries.state:null},transactions:state.transactions.filter(t=>privileged||t.from===actor.id||t.to===actor.id||(canTreasury(actor.role,'city')&&(t.from==='city'||t.to==='city'))||(canTreasury(actor.role,'state')&&(t.from==='state'||t.to==='state'))).slice(0,100),me,role:actor.role,demo:!!actor.demo};
}
