import {ownerCommands} from './owner-interactions.mjs';
import {commandDefinition} from './commands.mjs';
import {discord} from './bot.mjs';
import {staffCommands,STAFF_GUILD_ID} from './staff-interactions.mjs';
import {bankCommands,BANK_GUILD_ID} from './bank-interactions.mjs';
import {rgCommands} from './rg-interactions.mjs';
import {cnhExamCommands} from './cnh-exam.mjs';
const e=process.env;
for(const key of ['DISCORD_CLIENT_ID','DISCORD_BOT_TOKEN','DISCORD_GUILD_ID'])if(!e[key])throw Error('Configure '+key+' no ambiente privado.');
// Preserve the CPX commands in the original server.
for(const command of [commandDefinition,...ownerCommands,...cnhExamCommands,...rgCommands])await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+e.DISCORD_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN,{method:'POST',body:JSON.stringify(command)});
// Register staff commands only in the new staff server.
for(const command of staffCommands)await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+STAFF_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN,{method:'POST',body:JSON.stringify(command)});
for(const command of bankCommands)await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+BANK_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN,{method:'POST',body:JSON.stringify(command)});
const staffGuildCommands=await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+STAFF_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN);
for(const command of staffGuildCommands.filter(command=>['ver','banco'].includes(command.name)))await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+STAFF_GUILD_ID+'/commands/'+command.id,e.DISCORD_BOT_TOKEN,{method:'DELETE'});
// Remove an accidental copy of the staff commands from the original server without touching unrelated commands.
const original=await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+e.DISCORD_GUILD_ID+'/commands',e.DISCORD_BOT_TOKEN);
for(const command of original.filter(command=>['staff','player'].includes(command.name)))await discord('/applications/'+e.DISCORD_CLIENT_ID+'/guilds/'+e.DISCORD_GUILD_ID+'/commands/'+command.id,e.DISCORD_BOT_TOKEN,{method:'DELETE'});
console.log('Comandos CPX, /criar e /cnh registrados no servidor original. /staff e /player permanecem em '+STAFF_GUILD_ID+'. /ver e /banco foram registrados somente em '+BANK_GUILD_ID+'.');
