// A capture keeps its color, owns its timers, and ignores events after cancellation.
export class VoiceRecorder {
  constructor({ready,transcribe,interpret,onTranscript,onState,onError,getUserMedia,Recorder,setTimer=(callback,delay)=>globalThis.setTimeout(callback,delay),clearTimer=id=>globalThis.clearTimeout(id)}) {
    Object.assign(this,{ready,transcribe,interpret,onTranscript,onState,onError,getUserMedia,Recorder,setTimer,clearTimer});
    this.state='idle';this.capture=null;
  }
  setState(state,capture=this.capture){this.state=state;this.onState(state,capture);}
  current(capture){return this.capture===capture&&!capture.cancelled;}
  timer(capture,callback,delay){const id=this.setTimer(()=>{capture.timers.delete(id);if(this.current(capture))callback();},delay);capture.timers.add(id);return id;}
  stopTracks(stream){for(const track of stream?.getTracks()||[]){try{track.stop();}catch{}}}
  cleanup(capture){
    for(const id of capture.timers)this.clearTimer(id);capture.timers.clear();
    this.stopTracks(capture.stream);capture.stream=null;
  }
  detach(capture){if(capture.recorder)for(const event of ['onstop','ondataavailable','onerror'])capture.recorder[event]=null;}
  cancel(){
    const capture=this.capture;if(!capture)return;
    capture.cancelled=true;capture.controller.abort();this.detach(capture);
    try{if(capture.recorder?.state==='recording')capture.recorder.stop();}catch{}
    this.cleanup(capture);this.capture=null;this.setState('idle');
  }
  fail(capture,error){if(!this.current(capture))return;this.cancel();this.onError(error);}
  deadline(capture,promise,ms,message){
    return new Promise((resolve,reject)=>{
      const id=this.timer(capture,()=>{reject(Error(message));capture.controller.abort();},ms);
      Promise.resolve(promise).then(value=>{this.clearTimer(id);capture.timers.delete(id);resolve(value);},error=>{this.clearTimer(id);capture.timers.delete(id);reject(error);});
    });
  }
  async start(color,shortcut=null){
    if(this.state!=='idle')return;
    const capture={color,shortcut,cancelled:false,chunks:[],bytes:0,timers:new Set(),controller:new AbortController()};
    this.capture=capture;this.setState('requesting');
    try{
      await this.deadline(capture,this.ready(),15000,'Voice connection timed out. Please try again.');
      if(!this.current(capture))return;
      const pendingStream=this.getUserMedia().then(stream=>{if(!this.current(capture))this.stopTracks(stream);return stream;});
      const stream=await this.deadline(capture,pendingStream,30000,'Microphone did not open. Check permission and try again.');
      if(!this.current(capture)){this.stopTracks(stream);return;}
      capture.stream=stream;
      const type=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(t=>this.Recorder.isTypeSupported(t));
      capture.recorder=new this.Recorder(stream,type?{mimeType:type}:{});
      capture.recorder.ondataavailable=event=>{
        if(!this.current(capture)||capture.completing||!event.data.size)return;
        capture.chunks.push(event.data);capture.bytes+=event.data.size;
        if(capture.bytes>8*1024*1024)this.fail(capture,Error('Recording is too large. Try a shorter command.'));
      };
      capture.recorder.onerror=()=>this.fail(capture,Error('Audio recording failed. Please try again.'));
      capture.recorder.onstop=()=>this.complete(capture);
      // Stop once at the end rather than relying on periodic recorder chunks.
      capture.recorder.start();this.setState('recording');
      capture.recordTimer=this.timer(capture,()=>this.finish(),60000);
    }catch(error){this.fail(capture,error);}
  }
  finish(){
    const capture=this.capture;if(!capture)return;
    if(this.state==='requesting'){this.cancel();return;}
    if(this.state!=='recording')return;
    this.clearTimer(capture.recordTimer);capture.timers.delete(capture.recordTimer);
    this.setState('stopping');
    // Some browsers omit/delay onstop. Recover delivered data, or return to idle.
    capture.stopTimer=this.timer(capture,()=>{
      if(capture.chunks.length)this.complete(capture);
      else this.fail(capture,Error('The browser did not finish recording. Please try again.'));
    },4000);
    try{
      if(capture.recorder.state==='recording'){
        // Let stop emit the final complete audio. An immediate requestData() before
        // stop can produce WebM duration metadata of 0.001s, rejected by Groq.
        capture.recorder.stop();
      }
    }catch(error){this.fail(capture,error);}
  }
  release(shortcut){if(this.capture?.shortcut===shortcut)this.finish();}
  async complete(capture){
    if(!this.current(capture)||capture.completing)return;
    capture.completing=true;
    // Copy the final audio before releasing microphone tracks.
    const blob=new Blob(capture.chunks,{type:capture.recorder.mimeType});
    this.detach(capture);this.cleanup(capture);
    try{
      if(!blob.size)throw Error('No audio captured. Please try again.');
      this.setState('transcribing');
      const text=await this.deadline(capture,this.transcribe(blob,capture.controller.signal),30000,'Transcription took too long. Please try again.');
      if(!this.current(capture))return;
      let interpretation;
      if(this.interpret){
        this.setState('interpreting');
        interpretation=await this.deadline(capture,this.interpret(text,capture.color,capture.controller.signal),20000,'Interpretation took too long. Please try again.');
      }
      if(this.current(capture))this.onTranscript(text,capture.color,interpretation);
    }catch(error){if(this.current(capture))this.onError(error);}
    finally{if(this.capture===capture){this.cleanup(capture);this.capture=null;this.setState('idle');}}
  }
  dispose(){this.cancel();}
}
export function createColorSelection(){
  let chosen='white';const held=[];
  return {
    current:()=>held.length?({a:'white',s:'black'}[held[held.length-1]]):chosen,
    select(color){chosen=color;},
    hold(key){if(!held.includes(key))held.push(key);},
    release(key){const index=held.indexOf(key);if(index>=0)held.splice(index,1);},
    reset(){held.length=0;},
    heldKey:()=>held[held.length-1]||null
  };
}
