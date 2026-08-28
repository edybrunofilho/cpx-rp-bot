import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createStore} from './store.mjs';
import {setupPrivateArea} from './private-area.mjs';
const e=process.env;
for(const key of ['DISCORD_BOT_TOKEN','DISCORD_GUILD_ID','PUBLIC_ORIGIN'])if(!e[key])throw Error('Configure '+key+' no ambiente privado.');
if(!/^\d{17,22}$/.test(e.DISCORD_GUILD_ID)||!e.PUBLIC_ORIGIN.startsWith('https://'))throw Error('Servidor ou origem inválido.');
const dir=e.DATA_DIR||'./data';mkdirSync(dir,{recursive:true,mode:0o700});
const store=createStore(join(dir,'cpx.sqlite'));
try{const area=await setupPrivateArea(store,e);console.log('Área privada configurada: https://discord.com/channels/'+e.DISCORD_GUILD_ID+'/'+area.channel_id);}
finally{store.db.close();}
