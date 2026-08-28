import {ownerCommands} from './owner-interactions.mjs';
import {commandDefinition} from './commands.mjs';
import {discord} from './bot.mjs';
const e=process.env;
for(const key of ['DISCORD_CLIENT_ID','DISCORD_BOT_TOKEN','DISCORD_GUILD_ID'])if(!e[key])throw Error('Configure '+key+' no ambiente privado.');
// Upsert only the five CPX commands. Preserve unrelated commands.
for(const command of [commandDefinition,...ownerCommands])await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+e.DISCORD_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN,{method:'POST',body:JSON.stringify(command)});
console.log('Comandos /cpx, /cpxpainel, /guardian, /warn e /userinfo registrados. Libere os quatro comandos privados somente ao proprietário nas Integrações do servidor.');
