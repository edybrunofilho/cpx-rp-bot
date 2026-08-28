import {discord} from './bot.mjs';
import {OWNER_ID,createOwnerService} from './owner-service.mjs';
import {ownerMenu} from './owner-interactions.mjs';

export async function setupPrivateArea(store,e,api=discord){
  if(e.CONFIRM_PRIVATE_SETUP!=='true')throw Error('Autorize a criação com CONFIRM_PRIVATE_SETUP=true.');
  createOwnerService(store,e,api,{recover:false});
  const request=(path,options)=>api(path,e.DISCORD_BOT_TOKEN,options);
  await request('/guilds/'+e.DISCORD_GUILD_ID+'/members/'+OWNER_ID);
  const bot=await request('/users/@me');
  const overwrites=[{id:e.DISCORD_GUILD_ID,type:0,allow:'0',deny:'1024'},{id:OWNER_ID,type:1,allow:'19456',deny:'0'},{id:bot.id,type:1,allow:'19456',deny:'0'}];
  let area=store.db.prepare('SELECT * FROM owner_area WHERE id=1').get()||{};
  const root='/guilds/'+e.DISCORD_GUILD_ID+'/channels';
  if(area.category_id){
    const category=await request('/channels/'+area.category_id);
    if(category.guild_id!==e.DISCORD_GUILD_ID||category.type!==4)throw Error('Categoria salva inválida. Confira antes de continuar.');
    await request('/channels/'+area.category_id,{method:'PATCH',body:JSON.stringify({permission_overwrites:overwrites})});
  }else{
    const category=await request(root,{method:'POST',body:JSON.stringify({name:'cpx guardian · privado',type:4,permission_overwrites:overwrites})});
    area.category_id=category.id;
    store.db.prepare('INSERT INTO owner_area(id,category_id) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id').run(category.id);
  }
  if(area.channel_id){
    const channel=await request('/channels/'+area.channel_id);
    if(channel.guild_id!==e.DISCORD_GUILD_ID||channel.type!==0||channel.parent_id!==area.category_id)throw Error('Canal salvo inválido. Confira antes de continuar.');
    await request('/channels/'+area.channel_id,{method:'PATCH',body:JSON.stringify({permission_overwrites:overwrites})});
  }else{
    const channel=await request(root,{method:'POST',body:JSON.stringify({name:'painel-joaodayz',type:0,parent_id:area.category_id,permission_overwrites:overwrites,topic:'Painel exclusivo de joaodayz. Administradores do servidor podem ver o canal, mas os controles verificam o ID autorizado.'})});
    area.channel_id=channel.id;store.db.prepare('UPDATE owner_area SET channel_id=? WHERE id=1').run(channel.id);
  }
  const payload={...ownerMenu(e.PUBLIC_ORIGIN),allowed_mentions:{parse:[]}};
  if(area.message_id)await request('/channels/'+area.channel_id+'/messages/'+area.message_id,{method:'PATCH',body:JSON.stringify(payload)});
  else{
    const message=await request('/channels/'+area.channel_id+'/messages',{method:'POST',body:JSON.stringify(payload)});
    area.message_id=message.id;store.db.prepare('UPDATE owner_area SET message_id=? WHERE id=1').run(message.id);
  }
  return area;
}
