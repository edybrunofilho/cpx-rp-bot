import {createOwnerService,OWNER_PERMISSIONS} from './owner-service.mjs';
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createStore} from './store.mjs';
import {createNotifier,discord} from './bot.mjs';
import {createGuardianService} from './guardian-service.mjs';
import {createInteractionHandler} from './interactions.mjs';
import {staffCommands,STAFF_GUILD_ID} from './staff-interactions.mjs';
import {rgCommands} from './rg-interactions.mjs';
import {fail} from '../lib/cpx/engine.mjs';
const e=process.env;
for(const name of ['DISCORD_PUBLIC_KEY','DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET','DISCORD_BOT_TOKEN','DISCORD_GUILD_ID','DISCORD_ADMIN_ROLE_ID','DISCORD_MAYOR_ROLE_ID','DISCORD_GOVERNMENT_ROLE_ID','CPX_PROXY_SECRET','PUBLIC_ORIGIN'])if(!e[name])throw new Error('Configure '+name+' no ambiente privado do serviço.');
if(e.CPX_PROXY_SECRET.length<32)throw new Error('CPX_PROXY_SECRET deve ter pelo menos 32 caracteres aleatórios.');
for(const name of ['DISCORD_CLIENT_ID','DISCORD_GUILD_ID','DISCORD_ADMIN_ROLE_ID','DISCORD_MAYOR_ROLE_ID','DISCORD_GOVERNMENT_ROLE_ID'])if(!/^\d{17,22}$/.test(e[name]))throw new Error('ID inválido: '+name);
const origin=new URL(e.PUBLIC_ORIGIN).origin;if(!origin.startsWith('https://'))throw new Error('PUBLIC_ORIGIN deve usar HTTPS.');
const callback=origin+'/api/cpx/auth/callback';
const dataDir=e.DATA_DIR||'./data';mkdirSync(dataDir,{recursive:true,mode:0o700});
const store=createStore(join(dataDir,'cpx.sqlite'));const notifier=createNotifier(store,e.DISCORD_BOT_TOKEN);
const guardian=createGuardianService(store,e);const owner=createOwnerService(store,e);const interactionHandler=createInteractionHandler(store,guardian,e,fetch,owner);
async function registerStaffCommands(){
 for(const command of staffCommands)await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+STAFF_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN,{method:'POST',body:JSON.stringify(command)});
}
async function registerRgCommands(){
 for(const command of rgCommands)await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+e.DISCORD_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN,{method:'POST',body:JSON.stringify(command)});
}
if(e.DISCORD_PUBLIC_KEY&&!/^[0-9a-f]{64}$/i.test(e.DISCORD_PUBLIC_KEY))throw new Error('DISCORD_PUBLIC_KEY inválida.');
const random=()=>randomBytes(32).toString('hex');
function cookie(req,name){return String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';}
function setCookie(name,value,seconds){return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/api/cpx; Max-Age=${seconds}`;}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function redirect(res,to,cookies){res.writeHead(302,{Location:to,'Set-Cookie':cookies,'Cache-Control':'no-store'});res.end();}
function equal(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
async function body(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>2900000)fail('Limite de 2 MB para fotos.',413);chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{fail('JSON inválido.');}}
const limits=new Map();function rate(key,max,windowMs){const now=Date.now();let r=limits.get(key);if(!r||r.end<now)r={end:now+windowMs,count:0};r.count++;limits.set(key,r);if(limits.size>10000){for(const [k,v]of limits)if(v.end<now)limits.delete(k);}if(r.count>max)fail('Muitas solicitações. Aguarde um minuto.',429);}
async function actor(req){
 const token=cookie(req,'cpx_session');if(!/^[0-9a-f]{64}$/.test(token))fail('Entre pelo Discord para continuar.',401);
 const row=store.db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires>?').get(store.hash(token),Date.now());if(!row)fail('Sua sessão expirou. Entre novamente.',401);
 rate(row.user_id,60,60000);
 return guardian.memberActor(row.user_id);
}
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/healthz'&&req.method==='GET')return json(res,{ok:true});
  if(req.url?.split('?')[0]==='/discord/interactions'&&req.method==='POST')return await interactionHandler(req,res);
  if(!equal(req.headers['x-cpx-proxy-secret'],e.CPX_PROXY_SECRET))return json(res,{error:'Acesso não autorizado.'},401);
  const url=new URL(req.url,'https://backend.invalid'),path=url.pathname;
  if(path==='/config'&&req.method==='GET'){const invite=new URL('https://discord.com/oauth2/authorize');invite.search=new URLSearchParams({client_id:e.DISCORD_CLIENT_ID,scope:'bot applications.commands',permissions:OWNER_PERMISSIONS,guild_id:e.DISCORD_GUILD_ID,disable_guild_select:'true'}).toString();return json(res,{live:true,botInstallUrl:invite.href,aiEnabled:e.CPX_AI_ENABLED==='true'&&!!e.OPENAI_API_KEY&&!!e.OPENAI_MODEL});}
  if(path==='/auth/start'&&req.method==='GET'){
   rate('oauth-global',100,60000);const state=random();store.db.prepare('DELETE FROM oauth_states WHERE expires<?').run(Date.now());store.db.prepare('INSERT INTO oauth_states(state_hash,expires) VALUES(?,?)').run(store.hash(state),Date.now()+600000);
   const authorize=new URL('https://discord.com/oauth2/authorize');authorize.search=new URLSearchParams({client_id:e.DISCORD_CLIENT_ID,redirect_uri:callback,response_type:'code',scope:'identify',state,prompt:'consent'}).toString();return redirect(res,authorize.href,[setCookie('cpx_oauth',state,600)]);
  }
  if(path==='/auth/callback'&&req.method==='GET'){
   const state=url.searchParams.get('state')||'',saved=cookie(req,'cpx_oauth');if(!/^[a-f0-9]{64}$/.test(state)||!equal(state,saved))fail('Autorização inválida. Inicie o login novamente.',400);
   const consumed=store.db.prepare('DELETE FROM oauth_states WHERE state_hash=? AND expires>? RETURNING state_hash').get(store.hash(state),Date.now());if(!consumed)fail('Autorização expirada ou já utilizada.',400);
   const code=url.searchParams.get('code');if(!code)fail('Login cancelado no Discord.',400);
   const tokenResponse=await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:e.DISCORD_CLIENT_ID,client_secret:e.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:callback}),signal:AbortSignal.timeout(10000)});
   if(!tokenResponse.ok)fail('Não foi possível autorizar sua conta Discord. Tente novamente.',502);const tokens=await tokenResponse.json();
   const userResponse=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(10000)});if(!userResponse.ok)fail('Não foi possível obter o perfil Discord.',502);const user=await userResponse.json();
   if(!/^\d{17,22}$/.test(user.id))fail('Perfil Discord inválido.',502);
   let member;try{member=await discord('/guilds/'+e.DISCORD_GUILD_ID+'/members/'+user.id,e.DISCORD_BOT_TOKEN);}catch{fail('Entre no servidor CPX e confirme que o bot está instalado.',403);}if(member.pending)fail('Conclua a verificação do servidor.',403);
   store.register(user);const session=random();store.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());const old=cookie(req,'cpx_session');if(old)store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(store.hash(old));
   store.db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').run(store.hash(session),user.id,Date.now()+86400000);
   // The OAuth access token is never stored, returned to the browser or logged.
   return redirect(res,origin+'/',[setCookie('cpx_oauth','',0),setCookie('cpx_session',session,86400)]);
  }
  if(path==='/auth/logout'&&req.method==='POST'){const token=cookie(req,'cpx_session');if(token)store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(store.hash(token));res.setHeader('Set-Cookie',setCookie('cpx_session','',0));return json(res,{ok:true});}
  const who=await actor(req);
  if(path==='/owner/config'&&req.method==='GET')return json(res,owner.config(who));
  if(path==='/owner/state'&&req.method==='GET')return json(res,owner.state(who));
  if(path==='/owner/member'&&req.method==='GET')return json(res,await owner.member(who,url.searchParams.get('id')));
  if(path==='/owner/prepare'&&req.method==='POST')return json(res,await owner.prepare(who,await body(req)));
  if(path==='/owner/confirm'&&req.method==='POST')return json(res,await owner.confirm(who,(await body(req)).id));
  if(path==='/owner/cancel'&&req.method==='POST')return json(res,owner.cancel(who,(await body(req)).id));
  if(path==='/guardian/ask'&&req.method==='POST')return json(res,await guardian.ask(who,await body(req)));
  if(path==='/state'&&req.method==='GET')return json(res,store.snapshot(who));
  if(path==='/action'&&req.method==='POST'){const input=await body(req);return json(res,store.action(who,input));}
  if(path==='/upload'&&req.method==='POST'){
   const input=await body(req);if(typeof input.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(input.image))fail('Envie PNG, JPG ou WebP.');
   const [meta,b64]=input.image.split(',');const data=Buffer.from(b64,'base64');const mime=meta.slice(5).split(';')[0];
   const valid=(mime==='image/png'&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(mime==='image/jpeg'&&data[0]===255&&data[1]===216&&data[2]===255)||(mime==='image/webp'&&data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP');
   if(data.length>2000000||!valid)fail('Imagem inválida ou maior que 2 MB.');return json(res,store.setPhoto(who,mime,data));
  }
  if(/^\/photo\/\d{17,22}$/.test(path)&&req.method==='GET'){
   const id=path.split('/')[2];if(who.id!==id&&who.role!=='admin')fail('Você não tem acesso a esta foto.',403);const photo=store.db.prepare('SELECT mime,data FROM photos WHERE user_id=?').get(id);if(!photo)fail('Foto não encontrada.',404);res.writeHead(200,{'Content-Type':photo.mime,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'});return res.end(Buffer.from(photo.data));
  }
  json(res,{error:'Rota não encontrada.'},404);
 }catch(error){if(!res.headersSent)json(res,{error:error.status?error.message:'O serviço está temporariamente indisponível.'},error.status||503);else res.end();}
});
server.requestTimeout=20000;server.headersTimeout=15000;server.maxRequestsPerSocket=100;
const stop=notifier.start();const stopGuardian=guardian.start();server.listen(Number(e.PORT||3001),'0.0.0.0',()=>console.log('cpx guardian: serviço iniciado. Segredos não são registrados.'));
registerStaffCommands().then(()=>console.log('Comandos /staff e /player registrados no servidor de staff.')).catch(error=>console.error('Não foi possível registrar os comandos do servidor de staff:',error?.message||error));
registerRgCommands().then(()=>console.log('Comando /criar rg registrado no servidor CPX.')).catch(error=>console.error('Não foi possível registrar o comando /criar rg:',error?.message||error));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{stop();stopGuardian();server.close(()=>{store.db.close();process.exit(0);});});
