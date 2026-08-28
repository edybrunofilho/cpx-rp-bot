import {fail} from '../lib/cpx/engine.mjs';
import {embedMessage} from './embeds.mjs';

export const SSU_CHANNEL_ID='1536778465444106331';
export const SEND_POLLS=1n<<49n;
export const SSU_DEFAULTS={
  times:['17:50','18:30','19:00'],
  duration:24,
  message:'🚨 **Chegou a hora de decidir o horário da nossa SSU!**\n\nEscolha a opção que melhor se encaixa na sua disponibilidade:\n\n> 1️⃣ {h1}\n> 2️⃣ {h2}\n> 3️⃣ {h3}\n\n📌 **Vote com responsabilidade!** Escolha apenas um horário em que realmente possa comparecer.\n\n🤝 Contamos com a presença de todos para fortalecer a integração entre as corporações do **Complexo Paulista**.',
};

export function validateSsu(input){
  const times=Array.isArray(input.times)?input.times.map(t=>String(t).trim()):[];
  if(times.length!==3||times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))fail('Informe três horários válidos no formato HH:MM, como 17:50.');
  if(new Set(times).size!==3)fail('Os três horários devem ser diferentes.');
  const duration=Number(input.duration??24);
  if(!Number.isInteger(duration)||duration<1||duration>768)fail('A duração deve ser um número inteiro entre 1 e 768 horas.');
  const message=typeof input.message==='string'?input.message.trim():'';
  if(message.length<10||message.length>1500)fail('A mensagem deve ter entre 10 e 1500 caracteres.');
  for(const token of ['{h1}','{h2}','{h3}'])if(message.split(token).length!==2)fail('Mantenha {h1}, {h2} e {h3} uma vez cada na mensagem. Eles serão substituídos pelos horários.');
  return {times,duration,message};
}

export function ssuMessage(input){
  const draft=validateSsu(input);
  let description=draft.message;
  draft.times.forEach((time,index)=>{description=description.replace('{h'+(index+1)+'}',time);});
  description=description.replaceAll('@everyone','').replaceAll('@here','@\u200bhere').trim();
  return {...embedMessage('🔥・SSU',description),content:'**Convocação Geral:** ||@everyone||',allowed_mentions:{parse:['everyone']},poll:{
    question:{text:'Qual é o melhor horário para a nossa SSU?'},
    answers:draft.times.map((time,index)=>({poll_media:{text:time,emoji:{name:['1️⃣','2️⃣','3️⃣'][index]}}})),
    duration:draft.duration,allow_multiselect:false,layout_type:1,
  }};
}
