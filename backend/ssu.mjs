import {fail} from '../lib/cpx/engine.mjs';
import {embedMessage} from './embeds.mjs';

export const SSU_CHANNEL_ID='1536778465444106331';
export const SEND_POLLS=1n<<49n;
export const SSU_MODELS={
  vote:{
    label:'Votação de horários',
    times:['17:50','18:30','19:00'],
    duration:24,
    message:'🚨 **Chegou a hora de decidir o horário da nossa SSU!**\n\nEscolha a opção que melhor se encaixa na sua disponibilidade:\n\n> 1️⃣ {h1}\n> 2️⃣ {h2}\n> 3️⃣ {h3}\n\n📌 **Vote com responsabilidade!** Apenas escolha um horário caso realmente possa comparecer.\n\n🤝 Contamos com a presença de todos para fortalecer a integração entre as corporações do **Complexo Paulista**.',
  },
  offline:{
    label:'Server Off',
    message:'A cidade está fechada. Foi um prazer jogar com você. Agradecemos demais pela companhia. Até a próxima aventura, jogador! 🎮\n\n—\n\n> **FOCO:** Hoje foi divertido por sua causa. Não se esqueçam disso.',
  },
  start:{
    label:'Server Start',
    players:'0',
    temperature:'18',
    message:'<:SSU:1490347146858332291> **------- NO CPX!** 🚔\n\n<:Fundador:1500284415358533704> **O servidor está oficialmente aberto! Bora fazer um RP de qualidade?**\n\n➡️ **Quantidade de jogadores online:** {players}\n➡️ **Temperatura:** {temperature} °C – ❄️ Frio\n➡️ **Para uma melhor imersão, utilize roupas de acordo com a temperatura anunciada na SSU.**\n➡️ **Código do servidor:** `CPXERLCRP`\n\n> 📌 **Para entrar em nosso servidor, é obrigatório fazer parte do grupo oficial do Complexo Paulista (CPX). O link do grupo está disponível em nossos canais oficiais.**\n\n🚨 **Bom RP a todos! Respeitem as regras, valorizem a imersão e aproveitem a experiência.**',
  },
};
// Compatibilidade com rascunhos criados antes da inclusão dos três modelos.
export const SSU_DEFAULTS={model:'vote',...SSU_MODELS.vote};

const cleanMessage=value=>String(value??'').replaceAll('@everyone','').replaceAll('@here','@\u200bhere').trim();
function validateMessage(message){
  if(message.length<10||message.length>3500)fail('A mensagem deve ter entre 10 e 3500 caracteres.');
}
function once(message,tokens){
  for(const token of tokens)if(message.split(token).length!==2)fail('Mantenha '+tokens.join(', ')+' uma vez cada na mensagem. Esses campos serão substituídos antes da publicação.');
}
export function validateSsu(input){
  const model=String(input.model||'vote');
  if(!Object.hasOwn(SSU_MODELS,model))fail('Escolha um modelo de SSU válido.');
  const message=cleanMessage(input.message??SSU_MODELS[model].message);validateMessage(message);
  if(model==='vote'){
    const times=Array.isArray(input.times)?input.times.map(t=>String(t).trim()):[];
    if(times.length!==3||times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))fail('Informe três horários válidos no formato HH:MM, como 17:50.');
    if(new Set(times).size!==3)fail('Os três horários devem ser diferentes.');
    const duration=Number(input.duration??24);
    if(!Number.isInteger(duration)||duration<1||duration>768)fail('A duração deve ser um número inteiro entre 1 e 768 horas.');
    once(message,['{h1}','{h2}','{h3}']);
    return {model,message,times,duration};
  }
  if(model==='start'){
    const players=String(input.players??'').trim();
    const temperature=String(input.temperature??'').trim().replace(/\s*°?C$/i,'');
    if(!/^\d{1,4}$/.test(players))fail('Informe a quantidade de jogadores usando de 1 a 4 números.');
    if(!/^-?\d{1,2}(?:[.,]\d)?$/.test(temperature))fail('Informe uma temperatura válida, como 18 ou 18,5.');
    once(message,['{players}','{temperature}']);
    return {model,message,players,temperature:temperature.replace(',','.')};
  }
  return {model,message};
}

export function ssuMessage(input){
  const draft=validateSsu(input);
  let description=draft.message,title,content,poll;
  if(draft.model==='vote'){
    draft.times.forEach((time,index)=>{description=description.replace('{h'+(index+1)+'}',time);});
    title='🔥・SSU';content='**Convocação geral:** ||@everyone||';
    poll={question:{text:'Qual é o melhor horário para a nossa SSU?'},answers:draft.times.map((time,index)=>({poll_media:{text:time,emoji:{name:['1️⃣','2️⃣','3️⃣'][index]}}})),duration:draft.duration,allow_multiselect:false,layout_type:1};
  }else if(draft.model==='offline'){
    title='🏛️ SERVER OFF – COMPLEXO PAULISTA CPXRP 🏛️';content='**Menção:** ||@everyone||';
  }else{
    description=description.replace('{players}',draft.players).replace('{temperature}',draft.temperature);
    title='☁️ COMPLEXO PAULISTA – SERVER START (SSU)';content='**Informo:** ||@everyone||';
  }
  return {...embedMessage(title,description),content,allowed_mentions:{parse:['everyone']},...(poll?{poll}:{})};
}

