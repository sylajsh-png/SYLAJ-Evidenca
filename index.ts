import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response(null,{headers:cors});try{
const url=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const auth=req.headers.get('Authorization')||'';const client=createClient(url,key,{global:{headers:{Authorization:auth}}});const {data:{user}}=await client.auth.getUser();if(!user)return reply({error:'Unauthorized'},401);
const body=await req.json();const pub=Deno.env.get('VAPID_PUBLIC_KEY');if(!pub)return reply({error:'Push not configured'},503);if(body.action==='key')return reply({key:pub});
const {data:admin}=await client.rpc('sylaj_complete_admin');if(!admin)return reply({error:'Forbidden'},403);
const db=createClient(url,service);const {data:r,error}=await db.from('sylaj_complete_records').select('id,team_id,plan_revision').eq('id',body.id).eq('module','plan').is('deleted_at',null).single();if(error||!r)return reply({error:'Plan unavailable'},404);
const {data:team}=await db.from('ekipe').select('vodja_id').eq('id',r.team_id).single();if(!team?.vodja_id)return reply({error:'No leader'},409);
const {data:reads}=await db.from('sylaj_plan_reads').select('reader').eq('plan_id',r.id).eq('revision',r.plan_revision).eq('reader',team.vodja_id);if(reads?.length)return reply({sent:0,confirmed:true});
const {data:subs,error:se}=await db.from('sylaj_push_subscriptions').select('*').eq('user_id',team.vodja_id);if(se)throw se;
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!,pub,Deno.env.get('VAPID_PRIVATE_KEY')!);let sent=0,failed=0;for(const s of subs||[]){try{const endpoint=new URL(s.endpoint);if(endpoint.protocol!=='https:'||!['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'].some(h=>endpoint.hostname===h||endpoint.hostname.endsWith('.'+h)))throw Error('Unsupported endpoint');if(s.subscription.endpoint!==s.endpoint)throw Error('Endpoint mismatch');await webpush.sendNotification(s.subscription,JSON.stringify({title:'SYLAJ – Plan dela',body:'Keni një plan pune. Hapeni dhe konfirmoni leximin.',id:r.id}),{TTL:86400});sent++;}catch(e){failed++;if([404,410].includes(e.statusCode))await db.from('sylaj_push_subscriptions').delete().eq('user_id',s.user_id).eq('endpoint',s.endpoint);}}
return reply({sent,failed});}catch{return reply({error:'Push delivery error'},500);}});
