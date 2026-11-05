import assert from 'node:assert/strict';
import './public/logic.js';
import {VoiceRecorder} from './public/voice-recorder.js';
const {parseCommand,parseCommands}=globalThis.ChessEditor;
const pieces={king:'k',queen:'q',rook:'r',bishop:'b',knight:'n',pawn:'p'};
for(const [name,piece] of Object.entries(pieces))for(const color of ['white','black'])for(const phrase of [name+' e5','e5 '+name]){
 assert.deepEqual(parseCommand(phrase,color),{type:'place',piece:color==='white'?piece.toUpperCase():piece,square:'e5'});
}
assert.deepEqual(parseCommand('E five night','black'),{type:'place',piece:'n',square:'e5'});
assert.equal(parseCommand('white king e5','black').piece,'K');
assert.equal(parseCommand('e5 black king','white').piece,'k');
assert.deepEqual(parseCommands('king e5. f3 knight, rook a1','black').map(c=>c.piece),['k','n','r']);
assert.throws(()=>parseCommand('king e9','white'));
class FakeRecorder{
 static isTypeSupported(){return true;}
 constructor(){this.state='inactive';this.mimeType='audio/webm';}
 start(){this.state='recording';}
 stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['test audio'],{type:this.mimeType})});this.onstop?.();}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
let trackStops=0,resolveTranscript,received=[],errors=[];
const recorder=new VoiceRecorder({ready:async()=>{},getUserMedia:async()=>({getTracks:()=>[{stop:()=>trackStops++}]}),Recorder:FakeRecorder,transcribe:()=>new Promise(r=>resolveTranscript=r),onTranscript:(text,color)=>received.push(parseCommand(text,color)),onState:()=>{},onError:e=>errors.push(e),setTimer:()=>1,clearTimer:()=>{}});
await recorder.start('black','r');assert.equal(recorder.state,'recording');recorder.release('a');assert.equal(recorder.state,'recording');recorder.release('r');await flush();assert.equal(recorder.state,'transcribing');assert.equal(trackStops,1);
resolveTranscript('e5 king');await flush();assert.deepEqual(received,[{type:'place',piece:'k',square:'e5'}]);assert.equal(recorder.state,'idle');assert.equal(errors.length,0);
let resolveReady,opened=0,uploads=0;
const cancelled=new VoiceRecorder({ready:()=>new Promise(r=>resolveReady=r),getUserMedia:async()=>{opened++;return {getTracks:()=>[]};},Recorder:FakeRecorder,transcribe:async()=>{uploads++;return 'king e5';},onTranscript:()=>assert.fail('Cancelled recording applied'),onState:()=>{},onError:e=>{throw e;},setTimer:()=>1,clearTimer:()=>{}});
const pending=cancelled.start('white','r');cancelled.release('r');resolveReady();await pending;assert.equal(opened,0);assert.equal(uploads,0);assert.equal(cancelled.state,'idle');
await recorder.start('white','r');recorder.dispose();await flush();assert.equal(received.length,1);assert.equal(trackStops,2);assert.equal(recorder.state,'idle');
console.log('Short commands, both colors, release-before-transcription, quick-key cancellation, and recording cleanup passed.');
