const str=(name,description,required=true,extra={})=>({type:3,name,description,required,max_length:1000,...extra});
const user={type:6,name:'jogador',description:'Jogador cadastrado no portal',required:true};
const confirm={type:5,name:'confirmar',description:'Confirma a operação após conferir os dados',required:true};
const reason=str('motivo','Motivo da operação',true,{max_length:180,min_length:3});
const value=str('valor','Valor RP, exemplo: 100,50',true,{max_length:12,min_length:1});
const sub=(name,description,options=[])=>({type:1,name,description,options});
export const commandDefinition={name:'cpx',description:'cpx guardian — portal, banco, atendimento e moderação',type:1,options:[
 sub('ajuda','Conheça as funções do cpx guardian'),sub('saldo','Consulte seu saldo RP'),sub('extrato','Veja suas últimas cinco movimentações'),sub('rg','Veja seu RG de personagem'),sub('portal','Abra o portal CPX'),sub('status','Confira a disponibilidade do serviço'),
 sub('transferir','Transfira dinheiro RP para outro jogador',[user,value,reason,confirm]),
 sub('ajustar','Administração: adicione ou retire dinheiro RP',[user,str('operacao','Tipo de ajuste',true,{choices:[{name:'Adicionar',value:'credit'},{name:'Retirar',value:'debit'}]}),value,reason,confirm]),
 sub('pagar','Pague usando o caixa do seu cargo',[str('caixa','Caixa institucional',true,{choices:[{name:'Prefeitura',value:'city'},{name:'Governo',value:'state'}]}),user,value,reason,confirm]),
 sub('avisos','Ative ou desative os avisos financeiros por DM',[{type:5,name:'ativar',description:'Receber avisos de movimentações por DM',required:true}]),
 sub('perguntar','Receba ajuda contextual ou pergunte à IA opcional',[str('pergunta','Sua dúvida, sem dados pessoais ou segredos'),{type:5,name:'usar_ia',description:'Autoriza enviar esta pergunta à OpenAI, se habilitada pelo responsável',required:false}]),
 sub('advertir','Registre uma advertência interna no portal',[user,reason,confirm]),
 sub('castigo','Aplique ou remova um timeout no Discord',[user,{type:4,name:'minutos',description:'0 remove; máximo 1440 minutos',min_value:0,max_value:1440,required:true},reason,confirm]),
 sub('comunicado','Publique um comunicado no Instaplexo',[str('canal','Canal oficial',true,{choices:[{name:'Prefeitura',value:'prefeitura'},{name:'Administração',value:'administracao'},{name:'Banco',value:'banco'},{name:'Governo',value:'governo'}]}),str('texto','Conteúdo do comunicado',true,{min_length:3,max_length:1000}),confirm]),
 {type:2,name:'ticket',description:'Atendimento privado integrado ao portal',options:[sub('abrir','Abra um atendimento',[str('assunto','Assunto',true,{min_length:3,max_length:80}),str('mensagem','Descreva o que precisa',true,{min_length:3})]),sub('listar','Veja os seus tickets'),sub('responder','Responda a um atendimento',[str('id','ID completo do ticket',true,{max_length:36}),str('mensagem','Sua resposta')]),sub('fechar','Encerre um atendimento',[str('id','ID completo do ticket',true,{max_length:36}),confirm])]}
]};
