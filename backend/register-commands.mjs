import {ownerCommands} from './owner-interactions.mjs';
import {commandDefinition} from './commands.mjs';
import {discord} from './bot.mjs';
import {staffCommands,STAFF_GUILD_ID} from './staff-interactions.mjs';
import {rgCommands} from './rg-interactions.mjs';
const e=process.env;
for(const key of ['DISCORD_CLIENT_ID','DISCORD_BOT_TOKEN','DISCORD_GUILD_ID'])if(!e[key])throw Error('Configure '+key+' no ambiente privado.');
// Preserve the CPX commands in the original server.
for(const command of [commandDefinition,...ownerCommands,...rgCommands])await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+e.DISCORD_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN,{method:'POST',body:JSON.stringify(command)});
// Register staff commands only in the new staff server.
for(const command of staffCommands)await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+STAFF_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN,{method:'POST',body:JSON.stringify(command)});
// Remove an accidental copy of the staff commands from the original server without touching unrelated commands.
const original=await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+e.DISCORD_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN);
for(const command of original.filter(command=>['staff','player'].includes(command.name)))await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+e.DISCORD_GUILD_ID+'/commands/'+command.id,e.DISCORD_BOT_TOKEN,{method:'DELETE'});
console.log('Comandos CPX registrados no servidor original. /staff e /player registrados somente no servidor '+STAFF_GUILD_ID+'.');
