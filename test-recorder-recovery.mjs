import assert from 'node:assert/strict';
import {VoiceRecorder} from './public/voice-recorder.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function clock(){let seq=0,now=0;const timers=new Map();return {setTimer(fn,delay){const id=++seq;timers.set(id,{fn,time:now+delay});return id;},clearTimer(id){timers.delete(id);},advance(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.time<=now&&timers.delete(id))timer.fn();}};}
class NormalRecorder{
 static isTypeSupported(){return true;}
 constructor(){this.state='inactive';this.mimeType='audio/webm';}
 start(){this.state='recording';}
 requestData(){assert.fail('Use the final audio emitted by stop, without requestData.');}
 stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['audio'],{type:this.mimeType})});this.onstop?.();});}
}
function setup(Recorder=NormalRecorder,transcribe=async()=> 'king e5'){
 const time=clock(),errors=[],results=[],states=[];let tracksStopped=0,calls=0;
 const voice=new VoiceRecorder({Recorder,ready:async()=>{},getUserMedia:async()=>({getTracks:()=>[{stop:()=>tracksStopped++}]}),transcribe:async(...args)=>{calls++;return transcribe(...args);},onState:s=>states.push(s),onError:e=>errors.push(e.message),onTranscript:(text,color)=>results.push({text,color}),...time});
 return {voice,time,errors,results,states,get calls(){return calls;},get tracksStopped(){return tracksStopped;}};
}
let h=setup();await h.voice.start('black','s');h.voice.release('s');assert.equal(h.voice.state,'stopping');await flush();assert.equal(h.voice.state,'idle');assert.equal(h.calls,1);assert.deepEqual(h.results,[{text:'king e5',color:'black'}]);assert.equal(h.tracksStopped,1);
class NoStopEvent extends NormalRecorder{stop(){this.state='inactive';queueMicrotask(()=>this.ondataavailable?.({data:new Blob(['audio'],{type:this.mimeType})}));}}
h=setup(NoStopEvent);await h.voice.start('white','a');h.voice.release('a');await flush();assert.equal(h.voice.state,'stopping');h.time.advance(4000);await flush();assert.equal(h.voice.state,'idle');assert.equal(h.calls,1);assert.equal(h.results.length,1);
class NoAudioOrStop extends NoStopEvent{stop(){this.state='inactive';}}
h=setup(NoAudioOrStop);await h.voice.start('white','a');h.voice.finish();h.time.advance(4000);await flush();assert.equal(h.voice.state,'idle');assert.equal(h.calls,0);assert.match(h.errors[0],/did not finish/);assert.equal(h.tracksStopped,1);
h=setup(NormalRecorder,()=>new Promise(()=>{}));await h.voice.start('white','a');h.voice.finish();await flush();assert.equal(h.voice.state,'transcribing');h.time.advance(30000);await flush();assert.equal(h.voice.state,'idle');assert.match(h.errors[0],/too long/);
let resolveOld;h=setup(NormalRecorder,()=>new Promise(r=>resolveOld=r));await h.voice.start('black','s');h.voice.finish();await flush();h.voice.cancel();assert.equal(h.voice.state,'idle');await h.voice.start('white','a');resolveOld('king e5');await flush();assert.equal(h.voice.state,'recording');assert.equal(h.results.length,0);h.voice.cancel();
console.log('Async recorder stop, missing stop event, empty audio, hung service, cancellation and stale-result recovery passed.');
