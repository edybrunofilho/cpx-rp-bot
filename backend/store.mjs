import {DatabaseSync} from 'node:sqlite';
import {initialState,applyAction,fail,viewState,canTreasury} from '../lib/cpx/engine.mjs';
import {createHash,randomUUID} from 'node:crypto';
export function createStore(filename){
 const db=new DatabaseSync(filename);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS ai_usage(user_id TEXT NOT NULL,day TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(user_id,day));
 CREATE TABLE IF NOT EXISTS interactions(id TEXT PRIMARY KEY,status TEXT NOT NULL,at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS world(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS oauth_states(state_hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS receipts(actor TEXT NOT NULL,request_id TEXT NOT NULL,payload_hash TEXT NOT NULL,PRIMARY KEY(actor,request_id));
 CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,data TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,tx_id TEXT NOT NULL,user_id TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,error TEXT);
 CREATE INDEX IF NOT EXISTS outbox_queue ON outbox(status,next_attempt);
 CREATE TABLE IF NOT EXISTS photos(user_id TEXT PRIMARY KEY,mime TEXT NOT NULL,data BLOB NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,at INTEGER NOT NULL,detail TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT,'Ledger is append-only'); END;
 CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT,'Ledger is append-only'); END;`);
 db.prepare('INSERT OR IGNORE INTO world(id,data) VALUES(1,?)').run(JSON.stringify(initialState(false)));
 const hash=v=>createHash('sha256').update(v).digest('hex');
 const get=()=>JSON.parse(db.prepare('SELECT data FROM world WHERE id=1').get().data);
 const save=s=>{const {transactions,...rest}=s;db.prepare('UPDATE world SET data=? WHERE id=1').run(JSON.stringify({...rest,transactions:[]}));};
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 function snapshot(actor){const state=get();const accounts=[actor.id,...(canTreasury(actor.role,'city')?['city']:[]),...(canTreasury(actor.role,'state')?['state']:[])];const placeholders=accounts.map(()=>'?').join(',');const query=actor.role==='admin'?'SELECT data FROM ledger ORDER BY created DESC,rowid DESC LIMIT 100':`SELECT data FROM ledger WHERE json_extract(data,'$.from') IN (${placeholders}) OR json_extract(data,'$.to') IN (${placeholders}) ORDER BY created DESC,rowid DESC LIMIT 100`;state.transactions=db.prepare(query).all(...(actor.role==='admin'?[]:[...accounts,...accounts])).map(row=>{const tx=JSON.parse(row.data);const notifications=db.prepare('SELECT status FROM outbox WHERE tx_id=?').all(tx.id);tx.dm=!notifications.length?'Desativado':notifications.some(n=>n.status==='blocked')?'DM bloqueada':notifications.some(n=>n.status==='failed')?'Falha na DM':notifications.every(n=>n.status==='cancelled')?'Desativado':notifications.every(n=>n.status==='sent'||n.status==='cancelled')?'Enviado':'Na fila';return tx;});return {...viewState(state,actor),signedIn:true};}
 return {db,get,transaction,save,snapshot,hash,
  register(user){return transaction(()=>{const state=get();let me=state.players.find(p=>p.id===user.id);if(!me){me={id:user.id,name:user.global_name||user.username,handle:user.username,balance:0,rg:'CPX-'+String(state.players.length+1).padStart(4,'0'),birth:'2000-01-01',job:'Cidadão',photo:'',notifications:false};state.players.push(me);}me.handle=user.username;if(!me.photo||me.photo.startsWith('https://cdn.discordapp.com/'))me.photo=user.avatar?`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`:'';save(state);return me;});},
  action(actor,input){
   if(!/^[a-f0-9-]{36}$/.test(input.requestId||''))fail('Identificador da operação inválido.');
   const {demoRole,forceNotifications=false,...clean}=input;const payloadHash=hash(JSON.stringify(forceNotifications?{...clean,forceNotifications:true}:clean));
   return transaction(()=>{
    const receipt=db.prepare('SELECT payload_hash FROM receipts WHERE actor=? AND request_id=?').get(actor.id,input.requestId);
    if(receipt){if(receipt.payload_hash!==payloadHash)fail('O identificador já foi usado para outra operação.',409);return snapshot(actor);}
    const state=get();if(input.action==='comment'){const p=state.posts.find(p=>p.id===input.id);if(p?.comments.length>=300)fail('Limite de comentários desta publicação atingido.');}
    if(input.action==='post'&&state.posts.length>=5000)fail('Limite de publicações atingido. Solicite a manutenção do portal.');
    const {events}=applyAction(state,{...actor,demo:false},clean);
    for(const tx of events){
     db.prepare('INSERT INTO ledger(id,data,created) VALUES(?,?,?)').run(tx.id,JSON.stringify(tx),Date.now());
     for(const id of [tx.from,tx.to]){const player=state.players.find(p=>p.id===id);if(!player||(!forceNotifications&&!player.notifications))continue;
      const content={txId:tx.id,amount:tx.amount,reason:tx.reason,direction:tx.to===id?'credit':'debit',balance:player.balance,at:tx.at,forced:forceNotifications};
      db.prepare('INSERT INTO outbox(id,tx_id,user_id,payload) VALUES(?,?,?,?)').run(randomUUID(),tx.id,id,JSON.stringify(content));
     }
    }
    save(state);db.prepare('INSERT INTO receipts(actor,request_id,payload_hash) VALUES(?,?,?)').run(actor.id,input.requestId,payloadHash);
    db.prepare('INSERT INTO audit(id,actor,action,at,detail) VALUES(?,?,?,?,?)').run(randomUUID(),actor.id,input.action,Date.now(),JSON.stringify({requestId:input.requestId,transactionIds:events.map(t=>t.id)}));
    return snapshot(actor);
   });
  },
  setPhoto(actor,mime,data){return transaction(()=>{const s=get(),me=s.players.find(p=>p.id===actor.id);if(!me)fail('Conta não encontrada.',404);db.prepare('INSERT INTO photos(user_id,mime,data) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET mime=excluded.mime,data=excluded.data').run(actor.id,mime,data);me.photo='/api/cpx/photo/'+actor.id+'?v='+randomUUID();save(s);return snapshot(actor);});}
 };
}
