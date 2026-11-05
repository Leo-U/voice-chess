import assert from 'node:assert/strict';
import {transcribe} from './server/transcribe.mjs';
function request(audio=new Blob(['voice sample'],{type:'audio/webm'}),origin='https://chess.test'){const body=new FormData();body.set('audio',audio,'command.webm');return new Request('https://chess.test/api/transcribe',{method:'POST',headers:{Origin:origin},body});}
let calls=0;const mock=async(url,options)=>{calls++;assert.equal(url,'https://api.groq.com/openai/v1/audio/transcriptions');assert.equal(options.headers.Authorization,'Bearer test-key');assert.equal(options.body.get('model'),'whisper-large-v3');assert.match(options.body.get('prompt'),/Chess coordinates/);assert.ok(options.body.get('file').size);return Response.json({text:'White knight on f3.'});};
const env={GROQ_API_KEY:'test-key'};
let res=await transcribe(request(),env,mock);assert.equal(res.status,200);assert.deepEqual(await res.json(),{text:'White knight on f3.'});assert.equal(calls,1);
res=await transcribe(request(),{},mock);assert.equal(res.status,503);assert.equal(calls,1);
res=await transcribe(request(undefined,'https://another.test'),env,mock);assert.equal(res.status,403);assert.equal(calls,1);
res=await transcribe(request(new Blob(['not audio'],{type:'text/plain'})),env,mock);assert.equal(res.status,415);assert.equal(calls,1);
res=await transcribe(request(new Blob([],{type:'audio/webm'})),env,mock);assert.equal(res.status,400);
res=await transcribe(request(new Blob([new Uint8Array(8*1024*1024+1)],{type:'audio/webm'})),env,mock);assert.equal(res.status,413);
res=await transcribe(request(),env,async()=>new Response('sensitive upstream detail',{status:401}));assert.equal(res.status,502);assert.ok(!(await res.text()).includes('sensitive'));
res=await transcribe(request(),env,async()=>new Response('',{status:429}));assert.equal(res.status,502);
res=await transcribe(request(),env,async()=>{throw Error('network');});assert.equal(res.status,504);
res=await transcribe(request(),env,async()=>Response.json({text:''}));assert.equal(res.status,422);
res=await transcribe(new Request('https://chess.test/api/transcribe'),{});assert.deepEqual(await res.json(),{ready:false,model:'whisper-large-v3'});
res=await transcribe(new Request('https://chess.test/api/transcribe'),env);assert.deepEqual(await res.json(),{ready:true,model:'whisper-large-v3'});
console.log('12 transcription contract and failure checks passed (mocked model service; no live audio test).');
