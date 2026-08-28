import {commandDefinition} from './commands.mjs';
import {discord} from './bot.mjs';
const e=process.env;
for(const key of ['DISCORD_CLIENT_ID','DISCORD_BOT_TOKEN','DISCORD_GUILD_ID'])if(!e[key])throw Error('Configure '+key+' no ambiente privado.');
// Upsert only /cpx. Do not overwrite unrelated commands belonging to this app.
await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+e.DISCORD_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN,{method:'POST',body:JSON.stringify(commandDefinition)});
console.log('Comando /cpx do cpx guardian registrado no servidor configurado.');
