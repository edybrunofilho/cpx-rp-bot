import {createHash} from 'node:crypto';
import {discord} from './bot.mjs';
import {embedMessage,CPX_GREEN,CPX_RED} from './embeds.mjs';
import {money,fail} from '../lib/cpx/engine.mjs';
export const BANK_GUILD_ID='1168745784762703874';
export const BANK_CHANNEL_ID='1544850937187803228';

const ADMINISTRATOR=8n;
const user=(name,description,required=true)=>({type:6,name,description,required});
const text=(name,description,extra={})=>({type:3,name,description,required:true,...extra});
const confirm={type:5,name:'confirmar',description:'Confirme após revisar todos os dados',required:true};
const value=text('valor','Valor fictício de RP, exemplo: 100,50',{min_length:1,max_length:12});
const reason=text('motivo','Motivo da movimentação',{min_length:3,max_length:180});
const sub=(name,description,options=[])=>({type:1,name,description,options});

export const bankCommands=[
  {name:'ver',description:'Consultar informações bancárias no servidor interno',type:1,default_member_permissions:'8',options:[
    sub('extrato_bancario','Consultar o extrato bancário de um jogador',[user('jogador','Jogador que terá o extrato consultado')]),
    sub('saldo_bancario','Consultar o saldo bancário de um jogador',[user('jogador','Jogador que terá o saldo consultado')]),
  ]},
  {name:'banco',description:'Operações bancárias administrativas de roleplay',type:1,default_member_permissions:'8',options:[
    sub('saldo','Consultar o saldo de um jogador',[user('jogador','Jogador que terá o saldo consultado')]),
    sub('extrato','Consultar as dez últimas movimentações',[user('jogador','Jogador que terá o extrato consultado')]),
    sub('transferir','Transferir saldo fictício entre dois jogadores',[user('origem','Conta de origem'),user('destino','Conta de destino'),value,reason,confirm]),
    sub('depositar','Adicionar saldo fictício à conta de um jogador',[user('jogador','Jogador que receberá o depósito'),value,reason,confirm]),
    sub('retirar','Retirar saldo fictício da conta de um jogador',[user('jogador','Jogador que terá o saldo retirado'),value,reason,confirm]),
    sub('pagar','Pagar um jogador usando um caixa institucional',[{type:3,name:'caixa',description:'Caixa usado no pagamento',required:true,choices:[{name:'Prefeitura',value:'city'},{name:'Governo',value:'state'}]},user('jogador','Jogador que receberá o pagamento'),value,reason,confirm]),
  ]},
];

export const isBankCommand=i=>['ver','banco'].includes(i.data?.name);
const optionMap=i=>{
  const command=i.data?.options?.[0];
  return {command:command?.name,values:Object.fromEntries((command?.options||[]).map(option=>[option.name,option.value]))};
};
const requestId=id=>{
  const hex=createHash('sha256').update('discord-bank:'+id).digest('hex').slice(0,32);
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
};
const display=user=>user?.global_name||user?.username||'Usuário do Discord';
const account=(state,id)=>state.players.find(player=>player.id===id);
const transactionLines=(transactions,id)=>transactions.filter(tx=>tx.from===id||tx.to===id).slice(0,10).map(tx=>{
  const incoming=tx.to===id;
  const other=incoming?tx.from:tx.to;
  const otherLabel=other==='system'?'Sistema':other==='city'?'Prefeitura':other==='state'?'Governo':'<@'+other+'>';
  return `${incoming?'🟢 +':'🔴 −'} **${money(tx.amount)}** · ${tx.reason}\n${incoming?'Origem':'Destino'}: ${otherLabel}\nComprovante: \`${tx.id}\``;
});

export function createBankService(store,e,api=discord){
  const request=(path,options)=>api(path,e.DISCORD_BOT_TOKEN,options);
  async function publish(payload){
    await request('/channels/'+BANK_CHANNEL_ID+'/messages',{method:'POST',body:JSON.stringify(payload)});
  }
  function requireInternal(i){
    if(i.guild_id!==BANK_GUILD_ID)fail('Este comando está disponível somente no servidor bancário autorizado.',403);
    if((BigInt(i.member?.permissions||0)&ADMINISTRATOR)===0n)fail('Somente administradores podem utilizar a área bancária interna.',403);
  }
  function resolvedUser(i,id){
    const user=i.data?.resolved?.users?.[id];
    if(!user||user.bot)fail('Selecione um usuário válido que não seja um bot.');
    store.register(user);
    return user;
  }
  function adminActor(i){
    store.register(i.member.user);
    return {id:i.member.user.id,name:display(i.member.user),role:'admin'};
  }
  function balanceEmbed(player,actorId){
    return embedMessage('Saldo bancário','Consulta realizada no banco interno do CPX.',{color:CPX_GREEN,fields:[
      {name:'Titular',value:'<@'+player.id+'>\n'+player.name,inline:true},
      {name:'Saldo disponível',value:money(player.balance),inline:true},
      {name:'Consulta realizada por',value:'<@'+actorId+'>',inline:true},
    ],timestamp:new Date().toISOString(),footer:'CPX ROLEPLAY • Valores fictícios, sem valor real'});
  }
  function extractEmbed(state,id,actorId){
    const player=account(state,id);if(!player)fail('Conta bancária não encontrada.',404);
    const lines=transactionLines(state.transactions,id);
    return embedMessage('Extrato bancário',lines.join('\n\n')||'Nenhuma movimentação foi registrada nesta conta.',{fields:[
      {name:'Titular',value:'<@'+id+'>\n'+player.name,inline:true},
      {name:'Saldo atual',value:money(player.balance),inline:true},
      {name:'Consulta realizada por',value:'<@'+actorId+'>',inline:true},
    ],timestamp:new Date().toISOString(),footer:'CPX ROLEPLAY • Exibindo até 10 movimentações fictícias'});
  }
  async function execute(i){
    if(!isBankCommand(i))fail('Comando bancário não reconhecido.');
    requireInternal(i);
    const actor=adminActor(i);
    const {command,values:o}=optionMap(i);
    if(i.data.name==='ver'||['saldo','extrato'].includes(command)){
      const selected=resolvedUser(i,o.jogador);
      const state=store.snapshot(actor);
      const player=account(state,selected.id);if(!player)fail('Conta bancária não encontrada.',404);
      const payload=command==='extrato_bancario'||command==='extrato'?extractEmbed(state,selected.id,actor.id):balanceEmbed(player,actor.id);
      await publish(payload);
      return embedMessage('Consulta bancária publicada','O resultado foi enviado em <#'+BANK_CHANNEL_ID+'>.',{color:CPX_GREEN});
    }
    if(o.confirmar!==true)fail('Nenhuma movimentação foi realizada. Revise os dados e marque confirmar.',400);
    let action,target,source,operation,treasury;
    if(command==='transferir'){
      const from=resolvedUser(i,o.origem),to=resolvedUser(i,o.destino);
      if(from.id===to.id)fail('As contas de origem e destino devem ser diferentes.');
      source=from.id;target=to.id;action='bank_transfer';
    }else{
      const selected=resolvedUser(i,o.jogador);target=selected.id;
      if(command==='depositar'){action='adjust';operation='credit';}
      else if(command==='retirar'){action='adjust';operation='debit';}
      else if(command==='pagar'){action='treasury';treasury=o.caixa;}
      else fail('Operação bancária inválida.');
    }
    const id=requestId(i.id);
    const result=store.action(actor,{action,source,target,amount:o.valor,reason:o.motivo,operation,treasury,requestId:id,forceNotifications:true});
    const tx=result.transactions.find(item=>item.requestId===id);
    if(!tx)fail('A movimentação foi salva, mas o comprovante não foi localizado. Consulte o extrato.',503);
    const sourceBalance=account(result,tx.from)?.balance;
    const targetBalance=account(result,tx.to)?.balance;
    const fields=[
      {name:'Valor',value:money(tx.amount),inline:true},
      {name:'Comprovante',value:'`'+tx.id+'`',inline:true},
      {name:'Origem',value:tx.from==='system'?'Sistema':tx.from==='city'?'Prefeitura':tx.from==='state'?'Governo':'<@'+tx.from+'>',inline:true},
      {name:'Destino',value:tx.to==='system'?'Sistema':'<@'+tx.to+'>',inline:true},
      {name:'Motivo',value:tx.reason},
      {name:'Responsável',value:'<@'+actor.id+'>',inline:true},
      {name:'Avisos privados',value:'A DM foi colocada na fila para cada jogador afetado.'},
    ];
    if(Number.isInteger(sourceBalance))fields.push({name:'Saldo da origem',value:money(sourceBalance),inline:true});
    if(Number.isInteger(targetBalance))fields.push({name:'Saldo do destino',value:money(targetBalance),inline:true});
    const payload=embedMessage('Movimentação bancária concluída','A operação foi registrada no mesmo banco de dados do portal.',{color:CPX_GREEN,timestamp:tx.at,fields,footer:'CPX ROLEPLAY • Valores fictícios, sem valor real'});
    try{
      await publish(payload);
      return embedMessage('Movimentação concluída','O comprovante foi publicado em <#'+BANK_CHANNEL_ID+'> e as DMs foram colocadas na fila.',{color:CPX_GREEN});
    }catch{
      return embedMessage('Movimentação registrada','A movimentação foi concluída e as DMs foram colocadas na fila, mas o comprovante não pôde ser publicado em <#'+BANK_CHANNEL_ID+'>. Confira as permissões do bot e não repita a operação.',{color:CPX_RED,fields:[{name:'Comprovante',value:'`'+tx.id+'`'}]});
    }
  }
  return {execute};
}
