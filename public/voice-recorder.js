// A capture owns its input, timers and ordered phrase processing.
export class VoiceRecorder {
  constructor({ready,transcribe,interpret,onTranscript,onState,onError,getUserMedia,Recorder,watchPauses,setTimer=(callback,delay)=>globalThis.setTimeout(callback,delay),clearTimer=id=>globalThis.clearTimeout(id)}) {
    Object.assign(this,{ready,transcribe,interpret,onTranscript,onState,onError,getUserMedia,Recorder,watchPauses,setTimer,clearTimer});
    this.state='idle';this.capture=null;
  }
  setState(state,capture=this.capture){this.state=state;this.onState(state,capture);}
  current(capture){return this.capture===capture&&!capture.cancelled;}
  timer(capture,callback,delay){const id=this.setTimer(()=>{capture.timers.delete(id);if(this.current(capture))callback();},delay);capture.timers.add(id);return id;}
  clearCaptureTimer(capture,id){if(capture.timers.delete(id))this.clearTimer(id);}
  stopTracks(stream){for(const track of stream?.getTracks()||[]){try{track.stop();}catch{}}}
  stopWatcher(capture){
    capture.watcher?.stop();
    capture.watcher=null;
  }
  cleanup(capture){
    this.stopWatcher(capture);
    for(const id of capture.timers)this.clearTimer(id);capture.timers.clear();
    for(const segment of capture.segments){
      this.detach(segment);
      try{if(segment.recorder.state==='recording')segment.recorder.stop();}catch{}
      segment.resolve(null);
    }
    capture.segments.clear();
    this.stopTracks(capture.stream);capture.stream=null;
  }
  detach(segment){for(const event of ['onstop','ondataavailable','onerror'])segment.recorder[event]=null;}
  cancel(){
    const capture=this.capture;if(!capture)return;
    capture.cancelled=true;capture.controller.abort();
    this.cleanup(capture);this.capture=null;this.setState('idle');
  }
  fail(capture,error){if(!this.current(capture))return;this.cancel();this.onError(error);}
  deadline(capture,promise,ms,message){
    return new Promise((resolve,reject)=>{
      const id=this.timer(capture,()=>{reject(Error(message));capture.controller.abort();},ms);
      Promise.resolve(promise).then(value=>{this.clearCaptureTimer(capture,id);resolve(value);},error=>{this.clearCaptureTimer(capture,id);reject(error);});
    });
  }
  async start(color,shortcut=null){
    if(this.state!=='idle')return;
    const capture={color,shortcut,cancelled:false,segments:new Set(),timers:new Set(),controller:new AbortController(),pending:null,split:false};
    this.capture=capture;this.setState('requesting');
    try{
      await this.deadline(capture,this.ready(),15000,'Voice connection timed out. Please try again.');
      if(!this.current(capture))return;
      const pendingStream=this.getUserMedia().then(stream=>{if(!this.current(capture))this.stopTracks(stream);return stream;});
      const stream=await this.deadline(capture,pendingStream,30000,'Microphone did not open. Check permission and try again.');
      if(!this.current(capture)){this.stopTracks(stream);return;}
      capture.stream=stream;
      capture.mimeType=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(t=>this.Recorder.isTypeSupported(t));
      this.startSegment(capture);
      capture.watcher=this.watchPauses?.(stream,()=>this.splitPhrase(capture));
      this.setState('recording');
      capture.recordTimer=this.timer(capture,()=>this.finish(),60000);
    }catch(error){this.fail(capture,error);}
  }
  startSegment(capture){
    const recorder=new this.Recorder(capture.stream,capture.mimeType?{mimeType:capture.mimeType}:{});
    const segment={recorder,chunks:[],bytes:0,stopping:false};
    segment.audio=new Promise(resolve=>{segment.resolve=resolve;});
    capture.segment=segment;capture.segments.add(segment);
    recorder.ondataavailable=event=>{
      if(!this.current(capture)||!event.data.size)return;
      segment.chunks.push(event.data);segment.bytes+=event.data.size;
      if(segment.bytes>8*1024*1024)this.fail(capture,Error('Recording is too large. Try a shorter command.'));
    };
    recorder.onerror=()=>this.fail(capture,Error('Audio recording failed. Please try again.'));
    recorder.onstop=()=>{
      if(!segment.stopping&&this.current(capture))this.finish();
      this.completeSegment(capture,segment);
    };
    recorder.start();
  }
  stopSegment(capture,segment){
    segment.stopping=true;
    // Each stop emits a self-contained audio file. requestData() can emit invalid WebM duration metadata.
    segment.stopTimer=this.timer(capture,()=>this.completeSegment(capture,segment,true),4000);
    if(segment.recorder.state==='recording')segment.recorder.stop();
    return segment.audio;
  }
  completeSegment(capture,segment,timedOut=false){
    if(!capture.segments.delete(segment))return;
    this.clearCaptureTimer(capture,segment.stopTimer);
    this.detach(segment);
    const blob=new Blob(segment.chunks,{type:segment.recorder.mimeType});
    segment.resolve({blob,timedOut});
  }
  splitPhrase(capture){
    if(!this.current(capture)||this.state!=='recording'||capture.pending)return false;
    try{
      const audio=this.stopSegment(capture,capture.segment);
      this.startSegment(capture);
      capture.split=true;
      capture.pending=audio.then(clip=>this.processClip(capture,clip))
        .catch(error=>this.fail(capture,error)).finally(()=>{capture.pending=null;});
      return true;
    }catch(error){this.fail(capture,error);return false;}
  }
  finish(){
    const capture=this.capture;if(!capture)return;
    if(this.state==='requesting'){this.cancel();return;}
    if(this.state!=='recording')return;
    this.clearCaptureTimer(capture,capture.recordTimer);
    const trailingSilence=capture.split&&capture.watcher?.isQuiet();
    this.stopWatcher(capture);
    this.setState('stopping');
    try{
      const audio=this.stopSegment(capture,capture.segment);
      void this.finishCapture(capture,audio,trailingSilence);
    }catch(error){this.fail(capture,error);}
  }
  release(shortcut){if(this.capture?.shortcut===shortcut)this.finish();}
  async finishCapture(capture,audio,trailingSilence){
    try{
      const clip=await audio;
      if(!this.current(capture))return;
      this.stopTracks(capture.stream);capture.stream=null;
      await capture.pending;
      if(!trailingSilence)await this.processClip(capture,clip);
    }catch(error){if(this.current(capture))this.onError(error);}
    finally{if(this.capture===capture){this.cleanup(capture);this.capture=null;this.setState('idle');}}
  }
  async processClip(capture,clip){
    if(!this.current(capture))return;
    if(!clip.blob.size)throw Error(clip.timedOut?'The browser did not finish recording. Please try again.':'No audio captured. Please try again.');
    if(this.state!=='recording')this.setState('transcribing');
    const text=await this.deadline(capture,this.transcribe(clip.blob,capture.controller.signal),30000,'Transcription took too long. Please try again.');
    if(!this.current(capture))return;
    const color=capture.color;
    let interpretation;
    if(this.interpret){
      if(this.state!=='recording')this.setState('interpreting');
      interpretation=await this.deadline(capture,this.interpret(text,color,capture.controller.signal),20000,'Interpretation took too long. Please try again.');
    }
    if(!this.current(capture))return;
    this.onTranscript(text,color,interpretation);
    if(interpretation?.nextColor)capture.color=interpretation.nextColor;
  }
  dispose(){this.cancel();}
}
