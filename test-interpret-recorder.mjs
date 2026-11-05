import assert from 'node:assert/strict';
import {VoiceRecorder} from './public/voice-recorder.js';
class Recorder{static isTypeSupported(){return true;}constructor(){this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();}}
const flush=()=>new Promise(r=>setImmediate(r));
let resolveInterpret,seen=[],modes=[],errors=[];
const recorder=new VoiceRecorder({ready:async()=>{},getUserMedia:async()=>({getTracks:()=>[{stop(){}}]}),Recorder,transcribe:async()=> 'Put a king somewhere on e5.',interpret:(text,color,signal)=>{assert.equal(color,'black');return new Promise(r=>resolveInterpret=r);},onTranscript:(...args)=>seen.push(args),onState:mode=>modes.push(mode),onError:e=>errors.push(e),setTimer:()=>1,clearTimer:()=>{}});
await recorder.start('black','s');recorder.release('s');await flush();assert.equal(recorder.state,'interpreting');const result={status:'placements',commands:[{type:'place',piece:'k',square:'e5'}]};resolveInterpret(result);await flush();assert.equal(seen[0][2],result);assert.equal(recorder.state,'idle');
await recorder.start('black','s');recorder.release('s');await flush();recorder.cancel();resolveInterpret(result);await flush();assert.equal(seen.length,1);assert.equal(recorder.state,'idle');assert.equal(errors.length,0);
console.log('Voice transcription → interpretation → placement, frozen color and cancellation checks passed.');
