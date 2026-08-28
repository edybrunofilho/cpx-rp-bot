import { env } from 'cloudflare:workers';
export function bindings(){return env as unknown as {DB:D1Database;BUCKET:R2Bucket;CPX_BACKEND_URL?:string;CPX_PROXY_SECRET?:string};}
export function database(){return bindings().DB;}
