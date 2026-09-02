import {randomBytes} from 'node:crypto';
import {embedMessage,CPX_GREEN,CPX_RED} from './embeds.mjs';
import {fail} from '../lib/cpx/engine.mjs';

const choices=[
  {name:'A — Motocicletas',value:'A'},
  {name:'B — Automóveis',value:'B'},
  {name:'AB — Motocicletas e automóveis',value:'AB'},
  {name:'C — Veículos de carga',value:'C'},
  {name:'D — Transporte de passageiros',value:'D'},
  {name:'E — Veículos com unidade acoplada',value:'E'},
];
export const cnhExamCommands=[{name:'cnh',description:'Realizar a prova teórica fictícia da CNH do CPX',type:1,options:[{type:1,name:'iniciar',description:'Iniciar uma prova individual de habilitação',options:[{type:3,name:'categoria',description:'Categoria pretendida',required:true,choices}]}]}];
export const isCnhExamInteraction=i=>i.data?.name==='cnh'||String(i.data?.custom_id||'').startsWith('cnh_exam:');

const q=(text,answers,correct)=>({text,answers,correct});
const common=[
 q('Ao perceber um pedestre iniciando a travessia na faixa, qual é a conduta mais segura?',['Acelerar antes que ele avance','Reduzir e dar preferência','Buzinar continuamente','Desviar sem reduzir'],1),
 q('Sob chuva intensa, o veículo começa a aquaplanar. O que fazer primeiro?',['Frear bruscamente','Virar o volante rapidamente','Soltar o acelerador e manter o controle','Acelerar para recuperar aderência'],2),
 q('Uma viatura de emergência aproxima-se com sinais acionados. Qual é a ação adequada?',['Bloquear a passagem','Facilitar a passagem com segurança','Acompanhar a viatura','Parar no meio da pista'],1),
 q('Em neblina, qual iluminação é mais apropriada?',['Farol alto','Luzes apagadas','Farol baixo e, se houver, luz de neblina','Somente pisca-alerta em movimento'],2),
 q('Antes de mudar de faixa, o motorista deve:',['Olhar apenas o retrovisor interno','Sinalizar e conferir espelhos e ponto cego','Buzinar e mudar imediatamente','Frear no meio da via'],1),
 q('Se um pneu estourar durante o deslocamento, qual é a reação mais segura?',['Frear com força','Segurar o volante e reduzir gradualmente','Desligar o motor imediatamente','Virar para o acostamento de uma vez'],1),
 q('Ao sentir sono intenso durante uma viagem, o condutor deve:',['Abrir a janela e continuar','Aumentar a velocidade','Parar em local seguro e descansar','Usar o celular para se distrair'],2),
 q('Em uma descida longa, como evitar o superaquecimento dos freios?',['Usar marcha compatível e freio-motor','Manter o pedal pressionado continuamente','Descer em ponto morto','Desligar o veículo'],0),
 q('Por que a distância de segurança deve aumentar em pista molhada?',['Porque o motor perde potência','Porque a distância de frenagem aumenta','Porque os retrovisores deixam de funcionar','Porque a direção fica mais leve'],1),
 q('Ao chegar a um cruzamento com visão obstruída, a melhor conduta é:',['Acelerar para atravessar logo','Reduzir e avançar somente com visibilidade','Usar somente a buzina','Seguir o veículo da frente sem observar'],1),
 q('Após um acidente sem vítimas, quando for seguro, deve-se:',['Abandonar o veículo na faixa','Sinalizar e liberar a via','Ocultar o ocorrido','Permanecer bloqueando o trânsito'],1),
 q('A carga ou objetos soltos no veículo devem ser:',['Colocados próximos ao motorista','Fixados para impedir deslocamentos','Apoiados sobre os passageiros','Deixados livres para equilibrar o peso'],1),
];
const motorcycle=[
 q('Em uma motocicleta, a frenagem mais estável normalmente utiliza:',['Somente o freio traseiro','Somente o freio dianteiro','Os dois freios de forma progressiva','O desligamento do motor'],2),
 q('Ao transportar passageiro em motocicleta, ele deve:',['Movimentar-se no sentido contrário da curva','Manter os pés nas pedaleiras e acompanhar o condutor','Segurar objetos grandes nas mãos','Sentar-se de lado'],1),
 q('Em piso molhado com pintura viária, o motociclista deve:',['Fazer movimentos suaves e reduzir a inclinação','Acelerar sobre a pintura','Frear apenas sobre a faixa pintada','Inclinar mais a motocicleta'],0),
 q('Para aumentar sua visibilidade no trânsito, o motociclista deve:',['Permanecer no ponto cego dos carros','Usar iluminação e posicionamento visível','Circular com os faróis apagados','Costurar entre veículos'],1),
 q('Antes de pilotar, a cinta do capacete deve estar:',['Solta para maior conforto','Corretamente ajustada e presa','Presa somente em rodovias','Atrás do pescoço'],1),
 q('Em uma curva, a ação mais segura é:',['Frear bruscamente já inclinado','Ajustar a velocidade antes da curva','Olhar somente para a roda dianteira','Ultrapassar dentro da curva'],1),
];
const car=[
 q('Com freios ABS atuando em uma emergência, o motorista deve:',['Bombear rapidamente o pedal','Manter pressão firme e direcionar o veículo','Soltar completamente o freio','Puxar o freio de estacionamento'],1),
 q('Ao estacionar, qual cuidado reduz o risco de movimentação involuntária?',['Deixar em ponto morto','Acionar o freio de estacionamento','Manter o motor acelerado','Deixar as portas abertas'],1),
 q('Antes de uma viagem, a pressão dos pneus deve ser verificada:',['Somente após aquecê-los','Conforme a recomendação do veículo','Apenas quando estiverem visivelmente vazios','Usando a mesma pressão em qualquer carga'],1),
 q('Ao dar marcha a ré com visibilidade limitada, deve-se:',['Acelerar para concluir rapidamente','Manobrar lentamente e conferir todo o entorno','Observar apenas um retrovisor','Confiar somente nos sensores'],1),
 q('Em uma curva fechada, a velocidade deve ser ajustada:',['Antes de entrar na curva','Somente no meio da curva','Depois de sair da curva','Apenas se houver outro veículo'],0),
 q('Objetos sobre o painel podem ser perigosos porque:',['Melhoram a visibilidade','Podem virar projéteis e obstruir a visão','Diminuem o consumo','Aumentam a aderência'],1),
];
const cargo=[
 q('Uma carga com centro de gravidade alto aumenta principalmente o risco de:',['Economia de combustível','Tombamento em curvas','Melhora da frenagem','Redução do ponto cego'],1),
 q('Antes de partir com um veículo de carga, é essencial conferir:',['Somente a pintura','Fixação, distribuição e limites da carga','Apenas o rádio','Somente o combustível'],1),
 q('Se a carga se deslocar durante a viagem, o condutor deve:',['Continuar até o destino','Parar em local seguro e corrigir a fixação','Aumentar a velocidade','Fazer curvas para reposicioná-la'],1),
 q('Por que um veículo carregado exige maior distância de frenagem?',['Possui maior massa e inércia','Possui mais retrovisores','O volante fica menor','A buzina fica menos eficiente'],0),
 q('Ao planejar uma rota com veículo alto, deve-se verificar:',['Altura de pontes e restrições da via','Quantidade de lojas','Cor das placas','Somente a distância total'],0),
 q('Em descida longa com veículo pesado, o uso correto inclui:',['Marcha adequada e freio-motor','Ponto morto para economizar','Freio de estacionamento em movimento','Pedal de embreagem pressionado'],0),
];
const passenger=[
 q('No transporte de passageiros, arrancadas e frenagens devem ser:',['Bruscas para reduzir o tempo','Suaves e previsíveis','Feitas sem observar o salão','Realizadas com as portas abertas'],1),
 q('Antes de movimentar um veículo de passageiros, o condutor deve confirmar:',['Que as portas estão fechadas e o embarque terminou','Somente o horário','Que todos estão em pé','Que o corredor está bloqueado'],0),
 q('Ao aproximar-se de um ponto de embarque, deve-se:',['Parar afastado do meio-fio','Reduzir gradualmente e alinhar com segurança','Abrir as portas em movimento','Ultrapassar outros veículos pelo acostamento'],1),
 q('Em uma emergência, o motorista de passageiros deve priorizar:',['A bagagem','A segurança e evacuação organizada das pessoas','O cumprimento do horário','A continuidade da viagem'],1),
 q('Passageiros em pé exigem do condutor:',['Curvas mais rápidas','Maior suavidade e antecipação','Frenagens tardias','Menor distância de segurança'],1),
 q('Os pontos cegos de veículos grandes devem ser controlados por meio de:',['Espelhos, observação e manobras lentas','Aceleração durante a manobra','Buzina como única verificação','Orientação apenas dos passageiros'],0),
];
const articulated=[
 q('Em veículo articulado, o arraste das rodas traseiras em curvas exige:',['Traçado e espaço adicionais','Curvas mais fechadas','Aceleração constante','Uso do acostamento'],0),
 q('O efeito conhecido como “L” ou jackknife pode ocorrer principalmente por:',['Perda de alinhamento entre cavalo e reboque','Uso dos retrovisores','Carga bem distribuída','Baixa velocidade em linha reta'],0),
 q('Antes de partir com unidade acoplada, deve-se conferir:',['Engate, travas, conexões e apoio recolhido','Somente a placa dianteira','Apenas o nível de combustível','Somente as luzes internas'],0),
 q('Ao dar marcha a ré com reboque, os comandos devem ser:',['Rápidos e amplos','Lentos, pequenos e constantemente conferidos','Feitos sem retrovisores','Executados apenas com aceleração'],1),
 q('Vento lateral forte afeta mais um conjunto alto porque:',['Aumenta a área exposta ao vento','Reduz o comprimento do veículo','Elimina os pontos cegos','Melhora a aderência'],0),
 q('Uma distribuição inadequada da carga no reboque pode provocar:',['Instabilidade e perda de controle','Melhor consumo','Redução do balanço','Frenagem instantânea'],0),
 q('Após acoplar o semirreboque, o teste de tração serve para:',['Confirmar que o engate está travado','Aquecer os pneus','Calibrar o velocímetro','Testar a buzina'],0),
];

const settings={A:{count:6,label:'Básica'},B:{count:8,label:'Intermediária'},AB:{count:10,label:'Intermediária avançada'},C:{count:12,label:'Avançada'},D:{count:14,label:'Difícil'},E:{count:16,label:'Especializada'}};
const pool=category=>category==='A'?[...motorcycle,...common]:category==='B'?[...car,...common]:category==='AB'?[...motorcycle,...car,...common]:category==='C'?[...cargo,...common,...car]:category==='D'?[...passenger,...common,...cargo]:[...articulated,...cargo,...common];
const shuffle=list=>{const copy=[...list];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;};
const prepare=category=>shuffle(pool(category)).slice(0,settings[category].count).map(item=>{const indexed=item.answers.map((value,index)=>({value,index}));const mixed=shuffle(indexed);return {text:item.text,answers:mixed.map(x=>x.value),correct:mixed.findIndex(x=>x.index===item.correct)};});
const option=i=>i.data?.options?.[0]?.options?.find(x=>x.name==='categoria')?.value;
const letters=['A','B','C','D'];
const questionMessage=(exam,previous='')=>{const question=exam.questions[exam.position];return embedMessage(`Prova CNH ${exam.category} • Questão ${exam.position+1}/${exam.questions.length}`,question.text,{color:CPX_GREEN,fields:[{name:'Alternativas',value:question.answers.map((answer,index)=>`**${letters[index]})** ${answer}`).join('\n')},...(previous?[{name:'Questão anterior',value:previous}]:[])],footer:`CPX ROLEPLAY • Dificuldade ${settings[exam.category].label}`,components:[{type:1,components:question.answers.map((_,index)=>({type:2,style:1,label:letters[index],custom_id:`cnh_exam:${exam.id}:${index}`}))}]});};

export function createCnhExamService(store,e){
 store.db.exec(`CREATE TABLE IF NOT EXISTS cnh_exams(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,guild_id TEXT NOT NULL,category TEXT NOT NULL,questions TEXT NOT NULL,position INTEGER NOT NULL,correct INTEGER NOT NULL,expires INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS cnh_approvals(user_id TEXT NOT NULL,category TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,category));`);
 const approval={
  claim(userId,category){return store.db.prepare('UPDATE cnh_approvals SET used=1 WHERE user_id=? AND category=? AND used=0 AND expires>? RETURNING user_id').get(userId,category,Date.now())||null;},
  release(userId,category){store.db.prepare('UPDATE cnh_approvals SET used=0 WHERE user_id=? AND category=? AND expires>?').run(userId,category,Date.now());},
 };
 return {approval,async execute(i){
  if(i.guild_id!==e.DISCORD_GUILD_ID)fail('Utilize a prova no servidor CPX.',403);
  const userId=i.member?.user?.id;if(!userId)fail('Usuário inválido.',400);
  if(i.data?.name==='cnh'){
   const category=option(i);if(!settings[category])fail('Escolha uma categoria válida.');
   const id=randomBytes(10).toString('hex'),questions=prepare(category),expires=Date.now()+30*60*1000;
   store.db.prepare('DELETE FROM cnh_exams WHERE user_id=? OR expires<?').run(userId,Date.now());
   store.db.prepare('INSERT INTO cnh_exams(id,user_id,guild_id,category,questions,position,correct,expires) VALUES(?,?,?,?,?,?,?,?)').run(id,userId,i.guild_id,category,JSON.stringify(questions),0,0,expires);
   return questionMessage({id,category,questions,position:0,correct:0});
  }
  const match=/^cnh_exam:([a-f0-9]{20}):([0-3])$/.exec(i.data?.custom_id||'');if(!match)fail('Resposta de prova inválida.');
  const row=store.db.prepare('SELECT * FROM cnh_exams WHERE id=? AND user_id=? AND guild_id=?').get(match[1],userId,i.guild_id);if(!row||row.expires<Date.now()){if(row)store.db.prepare('DELETE FROM cnh_exams WHERE id=?').run(row.id);fail('Esta prova expirou. Use /cnh iniciar novamente.',410);}
  const questions=JSON.parse(row.questions),question=questions[row.position],right=Number(match[2])===question.correct,correct=row.correct+(right?1:0),position=row.position+1;
  if(position<questions.length){store.db.prepare('UPDATE cnh_exams SET position=?,correct=? WHERE id=?').run(position,correct,row.id);return questionMessage({id:row.id,category:row.category,questions,position,correct},right?'✅ Resposta correta.':'❌ Resposta incorreta.');}
  store.db.prepare('DELETE FROM cnh_exams WHERE id=?').run(row.id);const minimum=Math.ceil(questions.length*.7),passed=correct>=minimum;
  if(passed)store.db.prepare('INSERT INTO cnh_approvals(user_id,category,expires,used) VALUES(?,?,?,0) ON CONFLICT(user_id,category) DO UPDATE SET expires=excluded.expires,used=0').run(userId,row.category,Date.now()+24*60*60*1000);
  return embedMessage(passed?'✅ Aprovado na prova de CNH':'❌ Reprovado na prova de CNH',passed?`Você acertou **${correct} de ${questions.length}** questões. Agora use \`/criar cnh\`, escolha a categoria **${row.category}** e preencha seus dados. A autorização vale por 24 horas e pode ser usada uma vez.`:`Você acertou **${correct} de ${questions.length}** questões. Eram necessários ${minimum} acertos. Estude e use \`/cnh iniciar\` para tentar novamente.`,{color:passed?CPX_GREEN:CPX_RED,components:[]});
 }};
}
