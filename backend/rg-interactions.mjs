import {createHash} from 'node:crypto';
import {embedMessage,CPX_GREEN} from './embeds.mjs';
import {fail} from '../lib/cpx/engine.mjs';
import {cnhSubcommand} from './cnh-interactions.mjs';
import {documentFontStyle,loadDocumentRenderer} from './document-font.mjs';

const API='https://discord.com/api/v10';
export const RG_CHANNEL_ID='1510811319333425343';
const text=(name,description,max=60)=>({type:3,name,description,required:true,min_length:2,max_length:max});
export const rgCommands=[{
  name:'criar',description:'Criar documentos fictícios do Complexo Paulista',type:1,options:[{
    type:1,name:'rg',description:'Criar um RG fictício de roleplay com frente e verso',options:[
      {type:11,name:'foto',description:'Foto do personagem em PNG, JPG ou WebP',required:true},
      text('nome_completo','Nome completo fictício do personagem'),
      text('filiacao_1','Primeiro nome de filiação fictício'),
      text('filiacao_2','Segundo nome de filiação fictício'),
      text('nascimento','Data fictícia no formato DD/MM/AAAA',10),
      text('naturalidade','Cidade e estado fictícios',60),
      {type:3,name:'genero',description:'Gênero do personagem',required:true,choices:[{name:'Feminino',value:'Feminino'},{name:'Masculino',value:'Masculino'},{name:'Não binário',value:'Não binário'},{name:'Não informar',value:'Não informado'}]},
      text('profissao','Profissão fictícia do personagem'),
      {type:5,name:'confirmar',description:'Confirmo que todos os dados são fictícios e exclusivos para RP',required:true},
    ],
  },cnhSubcommand],
}];
export const isRgCommand=i=>i.data?.name==='criar'&&i.data?.options?.[0]?.name==='rg';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const options=i=>Object.fromEntries((i.data.options?.[0]?.options||[]).map(o=>[o.name,o.value]));
const validDate=value=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value||'');if(!m)return false;const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[1];};
const issued=()=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Campo_Grande'}).format(new Date());
const documentId=(userId,interactionId)=>'CPX-RP-'+createHash('sha256').update(userId+':'+interactionId).digest('hex').slice(0,8).toUpperCase();
const base=(side)=>`<rect width="1400" height="880" rx="38" fill="#eef1df"/><rect x="18" y="18" width="1364" height="844" rx="28" fill="none" stroke="#123f2c" stroke-width="18"/><rect x="42" y="42" width="1316" height="796" rx="20" fill="none" stroke="#b49a3a" stroke-width="3"/><path d="M70 120H1330M70 760H1330" stroke="#123f2c" stroke-width="3"/><text x="700" y="104" text-anchor="middle" font-size="44" font-weight="800" fill="#123f2c">COMPLEXO PAULISTA ROLEPLAY</text><text x="700" y="150" text-anchor="middle" font-size="26" font-weight="700" fill="#496250">CARTEIRA DE CIDADÃO • ${side}</text><text x="700" y="490" text-anchor="middle" font-size="160" font-weight="900" fill="#123f2c" opacity="0.055" transform="rotate(-18 700 490)">FICTÍCIO</text><rect y="780" width="1400" height="100" fill="#123f2c"/><text x="700" y="840" text-anchor="middle" font-size="31" font-weight="800" fill="#fff5c7">SEM VALIDADE OFICIAL • USO EXCLUSIVO PARA ROLEPLAY</text>`;
const label=(x,y,name,value,width=760)=>`<text x="${x}" y="${y}" font-size="20" font-weight="800" fill="#123f2c">${escape(name)}</text><rect x="${x}" y="${y+10}" width="${width}" height="56" rx="12" fill="#ffffff" fill-opacity=".58" stroke="#728474"/><text x="${x+18}" y="${y+48}" font-size="27" font-weight="600" fill="#183b2d">${escape(value)}</text>`;
export async function renderRgCards(data,photo){
  const sharp=await loadDocumentRenderer();
  const mime=data.photoType==='image/png'?'image/png':data.photoType==='image/webp'?'image/webp':'image/jpeg';
  const normalized=await sharp(photo).rotate().resize(330,440,{fit:'cover',position:'attention'}).jpeg({quality:88}).toBuffer();
  const image='data:image/jpeg;base64,'+normalized.toString('base64');
  const front=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="880"><style>${documentFontStyle}</style>${base('FRENTE')}<rect x="78" y="190" width="354" height="464" rx="20" fill="#d9decf" stroke="#123f2c" stroke-width="6"/><image href="${image}" x="90" y="202" width="330" height="440" preserveAspectRatio="xMidYMid slice"/>${label(470,205,'NOME COMPLETO',data.nome,820)}${label(470,305,'FILIAÇÃO 1',data.filiacao1,820)}${label(470,405,'FILIAÇÃO 2',data.filiacao2,820)}${label(470,505,'DATA DE NASCIMENTO',data.nascimento,370)}${label(880,505,'NATURALIDADE',data.naturalidade,410)}${label(470,605,'GÊNERO',data.genero,370)}${label(880,605,'PROFISSÃO',data.profissao,410)}<text x="255" y="710" text-anchor="middle" font-size="25" font-weight="700" fill="#123f2c">FOTO DO PERSONAGEM</text></svg>`;
  const back=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="880"><style>${documentFontStyle}</style>${base('VERSO')}<text x="110" y="225" font-size="30" font-weight="800" fill="#123f2c">REGISTRO DO PERSONAGEM</text>${label(110,265,'IDENTIFICADOR RP',data.documento,540)}${label(700,265,'DATA DE EMISSÃO',data.emissao,540)}${label(110,375,'TITULAR',data.nome,1130)}${label(110,485,'CONTA DISCORD',data.discord,540)}${label(700,485,'ÓRGÃO FICTÍCIO', 'CPX ROLEPLAY',540)}<rect x="110" y="610" width="1130" height="105" rx="18" fill="#dfe7d2" stroke="#123f2c" stroke-width="3"/><text x="675" y="650" text-anchor="middle" font-size="23" font-weight="800" fill="#123f2c">AVISO IMPORTANTE</text><text x="675" y="686" text-anchor="middle" font-size="22" fill="#294b3b">Documento virtual fictício, sem valor civil, legal ou governamental.</text></svg>`;
  return Promise.all([sharp(Buffer.from(front)).png().toBuffer(),sharp(Buffer.from(back)).png().toBuffer()]);
}
async function sendCards(channelId,token,data,front,back,request=fetch){
  const payload={content:'',embeds:[{title:'RG fictício • Frente',color:CPX_GREEN,image:{url:'attachment://rg-frente.png'},footer:{text:'CPX ROLEPLAY • Documento fictício, sem validade oficial'}},{title:'RG fictício • Verso',color:CPX_GREEN,image:{url:'attachment://rg-verso.png'},footer:{text:'CPX ROLEPLAY • Uso exclusivo para roleplay'}}],attachments:[{id:0,filename:'rg-frente.png'},{id:1,filename:'rg-verso.png'}],allowed_mentions:{parse:[]}};
  const form=new FormData();form.append('payload_json',JSON.stringify(payload));form.append('files[0]',new Blob([front],{type:'image/png'}),'rg-frente.png');form.append('files[1]',new Blob([back],{type:'image/png'}),'rg-verso.png');
  const response=await request(API+'/channels/'+channelId+'/messages',{method:'POST',headers:{Authorization:'Bot '+token},body:form,signal:AbortSignal.timeout(15000)});
  const body=await response.json().catch(()=>({}));if(!response.ok)fail('Não foi possível publicar o RG. Verifique as permissões do bot no canal.',response.status===403?403:503);return body;
}
export function createRgService(e,{request=fetch,renderer=renderRgCards}={}){
  return {async execute(i){
    if(i.guild_id!==e.DISCORD_GUILD_ID||!isRgCommand(i))fail('Utilize /criar rg no servidor CPX.',403);
    const o=options(i);if(o.confirmar!==true)fail('Confirme que os dados são fictícios e exclusivos para roleplay.');
    if(!validDate(o.nascimento))fail('Informe a data de nascimento no formato DD/MM/AAAA.');
    const attachment=i.data.resolved?.attachments?.[o.foto];
    if(!attachment||!['image/png','image/jpeg','image/webp'].includes(attachment.content_type)||attachment.size>5_000_000)fail('Envie uma foto PNG, JPG ou WebP de até 5 MB.');
    let response;try{response=await request(attachment.url,{signal:AbortSignal.timeout(10000)});}catch{fail('Não foi possível baixar a foto enviada.',503);}if(!response.ok)fail('Não foi possível baixar a foto enviada.',503);
    const photo=Buffer.from(await response.arrayBuffer());if(photo.length>5_000_000)fail('A foto ultrapassa o limite de 5 MB.');
    const data={nome:o.nome_completo,filiacao1:o.filiacao_1,filiacao2:o.filiacao_2,nascimento:o.nascimento,naturalidade:o.naturalidade,genero:o.genero,profissao:o.profissao,documento:documentId(i.member.user.id,i.id),emissao:issued(),discord:i.member.user.global_name||i.member.user.username,photoType:attachment.content_type};
    let cards;try{cards=await renderer(data,photo);}catch{fail('A foto não pôde ser processada. Envie outra imagem.',400);}
    await sendCards(RG_CHANNEL_ID,e.DISCORD_BOT_TOKEN,data,cards[0],cards[1],request);
    return embedMessage('RG fictício criado',`A frente e o verso foram publicados em <#${RG_CHANNEL_ID}>.`,{fields:[{name:'Identificador RP',value:data.documento},{name:'Mensagem',value:'Este documento não possui validade oficial.'}]});
  }};
}
