import {createHash} from 'node:crypto';
import {embedMessage,CPX_GREEN} from './embeds.mjs';
import {fail} from '../lib/cpx/engine.mjs';
import {documentFontStyle,loadDocumentRenderer} from './document-font.mjs';

const API='https://discord.com/api/v10';
const text=(name,description,max=60,required=true)=>({type:3,name,description,required,min_length:required?2:0,max_length:max});

export const cnhSubcommand={
  type:1,
  name:'cnh',
  description:'Criar uma CNH fictícia de roleplay com frente e verso',
  options:[
    {type:11,name:'foto',description:'Foto do personagem em PNG, JPG ou WebP',required:true},
    text('nome_completo','Nome completo fictício do personagem'),
    text('filiacao','Nome de filiação fictício'),
    text('nascimento','Data fictícia no formato DD/MM/AAAA',10),
    text('naturalidade','Cidade e estado fictícios',60),
    {type:3,name:'categoria',description:'Categoria fictícia da habilitação',required:true,choices:[
      {name:'A — Motocicletas',value:'A'},
      {name:'B — Automóveis',value:'B'},
      {name:'AB — Motocicletas e automóveis',value:'AB'},
      {name:'C — Veículos de carga',value:'C'},
      {name:'D — Transporte de passageiros',value:'D'},
      {name:'E — Veículos com unidade acoplada',value:'E'},
    ]},
    text('primeira_habilitacao','Data fictícia da primeira habilitação',10),
    text('validade','Data fictícia de validade',10),
    text('observacoes','Observações da CNH fictícia',80,false),
    {type:5,name:'confirmar',description:'Confirmo que os dados são fictícios e exclusivos para RP',required:true},
  ],
};

export const isCnhCommand=i=>i.data?.name==='criar'&&i.data?.options?.[0]?.name==='cnh';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const options=i=>Object.fromEntries((i.data.options?.[0]?.options||[]).map(o=>[o.name,o.value]));
const validDate=value=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value||'');if(!m)return false;const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[1];};
const issued=()=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Campo_Grande'}).format(new Date());
const documentId=(userId,interactionId)=>'CPX-CNH-'+createHash('sha256').update('cnh:'+userId+':'+interactionId).digest('hex').slice(0,8).toUpperCase();
const base=side=>`<rect width="1400" height="880" rx="38" fill="#eef1df"/><rect x="18" y="18" width="1364" height="844" rx="28" fill="none" stroke="#153f2d" stroke-width="18"/><rect x="42" y="42" width="1316" height="796" rx="20" fill="none" stroke="#b49a3a" stroke-width="3"/><path d="M70 120H1330M70 760H1330" stroke="#153f2d" stroke-width="3"/><text x="700" y="94" text-anchor="middle" font-size="40" font-weight="800" fill="#153f2d">COMPLEXO PAULISTA ROLEPLAY</text><text x="700" y="143" text-anchor="middle" font-size="27" font-weight="800" fill="#496250">CARTEIRA DE HABILITAÇÃO • ${side}</text><text x="700" y="500" text-anchor="middle" font-size="155" font-weight="900" fill="#153f2d" opacity="0.055" transform="rotate(-18 700 500)">FICTÍCIA</text><rect y="780" width="1400" height="100" fill="#153f2d"/><text x="700" y="840" text-anchor="middle" font-size="31" font-weight="800" fill="#fff5c7">SEM VALIDADE OFICIAL • USO EXCLUSIVO PARA ROLEPLAY</text>`;
const label=(x,y,name,value,width=760,size=27)=>`<text x="${x}" y="${y}" font-size="20" font-weight="800" fill="#153f2d">${escape(name)}</text><rect x="${x}" y="${y+10}" width="${width}" height="56" rx="12" fill="#fff" fill-opacity=".62" stroke="#728474"/><text x="${x+18}" y="${y+48}" font-size="${size}" font-weight="600" fill="#183b2d">${escape(value||'Não informado')}</text>`;

export async function renderCnhCards(data,photo){
  const sharp=await loadDocumentRenderer();
  const normalized=await sharp(photo).rotate().resize(330,440,{fit:'cover',position:'attention'}).jpeg({quality:88}).toBuffer();
  const image='data:image/jpeg;base64,'+normalized.toString('base64');
  const front=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="880"><style>${documentFontStyle}</style>${base('FRENTE')}<rect x="78" y="190" width="354" height="464" rx="20" fill="#d9decf" stroke="#153f2d" stroke-width="6"/><image href="${image}" x="90" y="202" width="330" height="440" preserveAspectRatio="xMidYMid slice"/>${label(470,195,'NOME COMPLETO',data.nome,820)}${label(470,292,'FILIAÇÃO',data.filiacao,820)}${label(470,389,'DATA DE NASCIMENTO',data.nascimento,390)}${label(900,389,'NATURALIDADE',data.naturalidade,390,23)}${label(470,486,'PRIMEIRA HABILITAÇÃO',data.primeira,390)}${label(900,486,'VALIDADE',data.validade,390)}${label(470,583,'NÚMERO DE REGISTRO RP',data.documento,620,25)}<rect x="1120" y="583" width="170" height="112" rx="18" fill="#153f2d"/><text x="1205" y="625" text-anchor="middle" font-size="19" font-weight="700" fill="#fff5c7">CATEGORIA</text><text x="1205" y="675" text-anchor="middle" font-size="45" font-weight="900" fill="#fff">${escape(data.categoria)}</text><text x="255" y="710" text-anchor="middle" font-size="25" font-weight="700" fill="#153f2d">FOTO DO PERSONAGEM</text></svg>`;
  const back=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="880"><style>${documentFontStyle}</style>${base('VERSO')}<text x="110" y="220" font-size="30" font-weight="800" fill="#153f2d">DADOS DA HABILITAÇÃO FICTÍCIA</text>${label(110,260,'IDENTIFICADOR RP',data.documento,540)}${label(700,260,'DATA DE EMISSÃO',data.emissao,540)}${label(110,370,'TITULAR',data.nome,1130)}${label(110,480,'OBSERVAÇÕES',data.observacoes||'Nenhuma observação registrada',1130,23)}<rect x="110" y="605" width="1130" height="110" rx="18" fill="#dfe7d2" stroke="#153f2d" stroke-width="3"/><text x="675" y="645" text-anchor="middle" font-size="23" font-weight="800" fill="#153f2d">AVISO IMPORTANTE</text><text x="675" y="683" text-anchor="middle" font-size="22" fill="#294b3b">Documento virtual fictício, sem valor civil, legal ou governamental.</text></svg>`;
  return Promise.all([sharp(Buffer.from(front)).png().toBuffer(),sharp(Buffer.from(back)).png().toBuffer()]);
}

async function sendCards(channelId,token,front,back,request=fetch){
  const payload={content:'',embeds:[{title:'CNH fictícia • Frente',color:CPX_GREEN,image:{url:'attachment://cnh-frente.png'},footer:{text:'CPX ROLEPLAY • Documento fictício, sem validade oficial'}},{title:'CNH fictícia • Verso',color:CPX_GREEN,image:{url:'attachment://cnh-verso.png'},footer:{text:'CPX ROLEPLAY • Uso exclusivo para roleplay'}}],attachments:[{id:0,filename:'cnh-frente.png'},{id:1,filename:'cnh-verso.png'}],allowed_mentions:{parse:[]}};
  const form=new FormData();form.append('payload_json',JSON.stringify(payload));form.append('files[0]',new Blob([front],{type:'image/png'}),'cnh-frente.png');form.append('files[1]',new Blob([back],{type:'image/png'}),'cnh-verso.png');
  const response=await request(API+'/channels/'+channelId+'/messages',{method:'POST',headers:{Authorization:'Bot '+token},body:form,signal:AbortSignal.timeout(15000)});
  await response.json().catch(()=>({}));if(!response.ok)fail('Não foi possível publicar a CNH. Verifique as permissões do bot no canal.',response.status===403?403:503);
}

export function createCnhService(e,{request=fetch,renderer=renderCnhCards}={}){
  return {async execute(i){
    if(i.guild_id!==e.DISCORD_GUILD_ID||!isCnhCommand(i))fail('Utilize /criar cnh no servidor CPX.',403);
    const o=options(i);if(o.confirmar!==true)fail('Confirme que os dados são fictícios e exclusivos para roleplay.');
    for(const [name,value] of [['nascimento',o.nascimento],['primeira habilitação',o.primeira_habilitacao],['validade',o.validade]])if(!validDate(value))fail('Informe a data de '+name+' no formato DD/MM/AAAA.');
    const attachment=i.data.resolved?.attachments?.[o.foto];
    if(!attachment||!['image/png','image/jpeg','image/webp'].includes(attachment.content_type)||attachment.size>5_000_000)fail('Envie uma foto PNG, JPG ou WebP de até 5 MB.');
    let response;try{response=await request(attachment.url,{signal:AbortSignal.timeout(10000)});}catch{fail('Não foi possível baixar a foto enviada.',503);}if(!response.ok)fail('Não foi possível baixar a foto enviada.',503);
    const photo=Buffer.from(await response.arrayBuffer());if(photo.length>5_000_000)fail('A foto ultrapassa o limite de 5 MB.');
    const data={nome:o.nome_completo,filiacao:o.filiacao,nascimento:o.nascimento,naturalidade:o.naturalidade,categoria:o.categoria,primeira:o.primeira_habilitacao,validade:o.validade,observacoes:o.observacoes||'',documento:documentId(i.member.user.id,i.id),emissao:issued()};
    let cards;try{cards=await renderer(data,photo);}catch{fail('A foto não pôde ser processada. Envie outra imagem.',400);}
    await sendCards(i.channel_id,e.DISCORD_BOT_TOKEN,cards[0],cards[1],request);
    return embedMessage('CNH fictícia criada','A frente e o verso foram publicados neste canal.',{fields:[{name:'Categoria',value:data.categoria,inline:true},{name:'Identificador RP',value:data.documento,inline:true},{name:'Aviso',value:'Este documento não possui validade oficial.'}]});
  }};
}
