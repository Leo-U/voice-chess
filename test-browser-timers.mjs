import assert from 'node:assert/strict';
import {VoiceRecorder} from './public/voice-recorder.js';
const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
let id=0,setCalls=0,clearCalls=0;const timers=new Map();
// Browser timer functions reject an arbitrary object as their receiver.
globalThis.setTimeout=function(callback,delay){assert.equal(this,globalThis,'Illegal invocation: timer receiver');setCalls++;timers.set(++id,{callback,delay});return id;};
globalThis.clearTimeout=function(timer){assert.equal(this,globalThis,'Illegal invocation: timer receiver');clearCalls++;timers.delete(timer);};
class Recorder{
 static isTypeSupported(){return true;}
 constructor(){this.state='inactive';this.mimeType='audio/webm';}
 start(){this.state='recording';}
 requestData(){assert.fail('Do not flush separately before stop: it corrupts native WebM duration.');}
 stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['voice'],{type:this.mimeType})});this.onstop?.();}
}
const errors=[],transcripts=[];let tracksStopped=0;
try{
 const voice=new VoiceRecorder({ready:async()=>{},transcribe:async()=> 'king e5',onTranscript:(text,color)=>transcripts.push({text,color}),onState:()=>{},onError:e=>errors.push(e.message),getUserMedia:async()=>({getTracks:()=>[{stop:()=>tracksStopped++}]}),Recorder});
 await voice.start('white','a');assert.equal(voice.state,'recording');voice.release('a');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(voice.state,'idle');assert.deepEqual(errors,[]);assert.deepEqual(transcripts,[{text:'king e5',color:'white'}]);assert.equal(tracksStopped,1);assert.ok(setCalls>0&&clearCalls>0);assert.equal(timers.size,0);
 console.log('Browser-context timer regression passed.');
}finally{globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
