import {readFile} from 'node:fs/promises';
import {discord} from './bot.mjs';
if(!process.env.DISCORD_BOT_TOKEN)throw Error('Configure DISCORD_BOT_TOKEN no ambiente privado.');
const image=await readFile(new URL('../public/cpx-brand.png',import.meta.url));
await discord('/users/@me',process.env.DISCORD_BOT_TOKEN,{method:'PATCH',body:JSON.stringify({username:'cpx guardian',avatar:'data:image/png;base64,'+image.toString('base64')})});
console.log('Nome e avatar do bot atualizados para cpx guardian. O nome do aplicativo deve ser atualizado no Developer Portal.');
