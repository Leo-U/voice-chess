import {VoiceRecorder} from './voice-recorder.js';
const {START,parseFen,toFen,parseCommands,applyEdits}=ChessEditor;
const $=id=>document.getElementById(id),clone=v=>JSON.parse(JSON.stringify(v));
const themeRoot = document.documentElement;
const themeToggle = $('theme-toggle');
function updateThemeLabel() {
 themeToggle.textContent = themeRoot.dataset.theme === 'light' ? 'Dark mode' : 'Light mode';
}
updateThemeLabel();
themeToggle.onclick = () => {
 const theme = themeRoot.dataset.theme === 'light' ? 'dark' : 'light';
 themeRoot.dataset.theme = theme;
 updateThemeLabel();
 document.querySelector('meta[name="theme-color"]').content = getComputedStyle(themeRoot).getPropertyValue('--paper').trim();
 try { localStorage.setItem('voice-chess-theme', theme); } catch {}
};
const glyphs={K:'♚',Q:'♛',R:'♜',B:'♝',N:'♞',P:'♟',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const names={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
const recordShortcut = 'r';
let state=parseFen(START),selected='N',flipped=false,last=[],undo=[],redo=[];
let activeColor = null;let voiceRecorder;let typedBusy=false;let typedController;
const commandInput = $('command');
let voiceDraft = null;
const stripVoicePunctuation = text => text.replace(/[,.]/g, '');
try{const saved=localStorage.getItem('voice-chess-groq-position');if(saved)state=parseFen(saved);}catch{}
function pieceName(p){return (p===p.toUpperCase()?'White ':'Black ')+names[p.toLowerCase()];}
function feedback(msg,error=false){$('feedback').textContent=msg;$('feedback').classList.toggle('error',error);}
function save(){try{localStorage.setItem('voice-chess-groq-position',toFen(state));}catch{$('fen-status').textContent='Position available this session.';}}
function render(){let b=$('board');b.replaceChildren();let ranks=flipped?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1],files=flipped?'hgfedcba':'abcdefgh';ranks.forEach((r,ri)=>[...files].forEach((f,fi)=>{let sq=f+r,p=state.board[sq],button=document.createElement('button');button.className='square'+(('abcdefgh'.indexOf(f)+r)%2===1?' dark':'')+(last.includes(sq)?' last':'');button.dataset.square=sq;button.setAttribute('aria-label',sq+(p?', '+pieceName(p):', empty'));button.title=sq+(p?' · '+pieceName(p):'');if(p){let span=document.createElement('span');span.className='piece '+(p===p.toUpperCase()?'white':'black');span.textContent=glyphs[p];button.append(span);}if(fi===0){let label=document.createElement('span');label.className='coord rank';label.textContent=r;button.append(label);}if(ri===7){let label=document.createElement('span');label.className='coord file';label.textContent=f;button.append(label);}button.onclick=()=>change(s=>{if(selected)s.board[sq]=selected;else delete s.board[sq];},[sq],selected?`${pieceName(selected)} placed on ${sq}.`:`Cleared ${sq}.`);button.oncontextmenu=e=>{e.preventDefault();change(s=>delete s.board[sq],[sq],`Cleared ${sq}.`);};b.append(button);}));$('piece-count').textContent=Object.keys(state.board).length+' pieces';$('fen').value=toFen(state);$('turn').value=state.turn;$('ep').value=state.ep;$('half').value=state.half;$('full').value=state.full;document.querySelectorAll('[data-castle]').forEach(c=>c.checked=state.castles.includes(c.dataset.castle));$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;save();}
function change(fn,squares=[],msg='Position updated.'){let next=clone(state);fn(next);if(toFen(next)!==toFen(state)){undo.push(clone(state));if(undo.length>100)undo.shift();redo=[];state=next;}last=squares;render();feedback(msg);}
function restore(direction){let source=direction==='undo'?undo:redo,target=direction==='undo'?redo:undo;if(!source.length){feedback('Nothing to '+direction+'.');return;}target.push(clone(state));state=source.pop();last=[];render();feedback(direction==='undo'?'Last edit undone.':'Edit restored.');}
function updateColorUI() {
 const colorLabel = activeColor ? activeColor[0].toUpperCase() + activeColor.slice(1) : 'Say white or black';
 const recording = voiceRecorder?.state === 'recording';
 $('color-hint').textContent = (recording ? 'Listening · ' : 'Active color · ') + colorLabel;
 document.querySelectorAll('#palette button').forEach(button => {
  button.classList.toggle('selected', button.dataset.piece === selected);
 });
 $('eraser').classList.toggle('selected', selected === null);
 $('selection').textContent = selected ? pieceName(selected) + ' selected · click a square to place' : 'Eraser selected · click a square to remove';
}
function setActiveColor(color) {
 activeColor = color;
 if (selected) selected = color === 'white' ? selected.toUpperCase() : selected.toLowerCase();
 updateColorUI();
}
function setSelection(piece) {
 selected = piece;
 if (piece) setActiveColor(piece === piece.toUpperCase() ? 'white' : 'black');
 else updateColorUI();
}
for(let p of 'KQRBNPkqrbnp'){let b=document.createElement('button');b.dataset.piece=p;b.title=pieceName(p);b.setAttribute('aria-label',pieceName(p));b.innerHTML=`<span class="piece ${p===p.toUpperCase()?'white':'black'}">${glyphs[p]}</span>`;b.onclick=()=>setSelection(p);$('palette').append(b);}
$('eraser').onclick=()=>setSelection(null);$('undo').onclick=()=>restore('undo');$('redo').onclick=()=>restore('redo');$('flip').onclick=()=>{flipped=!flipped;render();};$('clear').onclick=()=>change(s=>{s.board={};s.castles='-';s.ep='-';},[],'Board cleared. Undo to restore.');$('start').onclick=()=>change(s=>Object.assign(s,parseFen(START)),[],'Starting position restored.');
$('turn').onchange=e=>change(s=>s.turn=e.target.value);
document.querySelectorAll('[data-castle]').forEach(c=>c.onchange=()=>change(s=>{s.castles=[...document.querySelectorAll('[data-castle]:checked')].map(c=>c.dataset.castle).join('')||'-';}));
for(let id of ['ep','half','full'])$(id).onchange=()=>{try{let s=clone(state);s[id]=id==='ep'?$(id).value.trim().toLowerCase():Number($(id).value);let valid=parseFen(toFen(s));change(v=>Object.assign(v,valid));}catch(e){feedback(e.message,true);render();}};
$('fen-form').onsubmit=e=>{e.preventDefault();try{const s=parseFen($('fen').value);change(v=>Object.assign(v,s),[],'Position imported.');$('fen-status').textContent='Position imported successfully.';$('fen-status').classList.remove('error');}catch(err){$('fen-status').textContent=err.message;$('fen-status').classList.add('error');}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(toFen(state));$('fen-status').textContent='FEN copied to clipboard.';$('fen-status').classList.remove('error');}catch{$('fen').focus();$('fen').select();$('fen-status').textContent='Select and copy the FEN above.';}};
function applyCommands(commands,text){if(!commands.length)return;if(commands.length>1&&commands.some(c=>['undo','redo','flip','clear','start'].includes(c.type)))throw Error('Use board commands individually.');let c=commands[0];if(c.type==='undo'||c.type==='redo'){restore(c.type);return;}if(c.type==='flip'){$('flip').click();feedback('Board flipped.');return;}if(c.type==='clear'){$('clear').click();return;}if(c.type==='start'){$('start').click();return;}let squares=[];change(s=>{applyEdits(s,commands);for(const c of commands){if(c.type==='move')squares.push(c.from,c.to);else if(c.square)squares.push(c.square);}},squares,commands.length>1?`${commands.length} edits applied.`:text+' ✓');}
async function interpretText(text,color,signal,{spoken=false}={}){
 // Keep existing explicit editor operations; all placements go through the LLM.
 try{const commands=parseCommands(text,color);if(commands.length&&commands.every(c=>c.type!=='place'))return {status:'placements',commands,legacy:true};}catch{}
 const commandText=spoken?stripVoicePunctuation(text):text;
 if(!commandText.trim())return {status:'none',message:'No spoken command recognized.'};
 const response=await fetch('/api/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:commandText,color}),signal});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Interpretation failed.');return data;
}
function applyInterpretation(result, text) {
 if (result.status === 'color') {
  setActiveColor(result.nextColor);
  feedback('Active color set to ' + result.nextColor + '.');
  return;
 }
 if (result.status !== 'placements') {
  feedback(result.message + ' No pieces changed.', result.status === 'clarification');
  return;
 }
 applyCommands(result.commands, text);
 if (result.nextColor) setActiveColor(result.nextColor);
 if (!result.legacy) {
  const descriptions = result.commands.map(command => command.type === 'remove'
   ? 'Cleared ' + command.square
   : 'Placed ' + pieceName(command.piece) + ' on ' + command.square);
  feedback(descriptions.join(' · ') + '.');
 }
}
async function execute(text, color = activeColor, options) {
 if(typedBusy||voiceRecorder&&voiceRecorder.state!=='idle'){feedback('Wait for the current command to finish, or cancel it.',true);return;}
 if(!text.trim())return;
 typedBusy=true;typedController=new AbortController();const timer=globalThis.setTimeout(()=>typedController.abort(),20000);
 $('command-form').querySelector('button').disabled=true;$('listen').disabled=true;feedback('Interpreting your placement…');
 try{applyInterpretation(await interpretText(text,color,typedController.signal,options),text);}catch(e){feedback((e.name==='AbortError'?'Interpretation timed out. Please try again.':e.message)+' No pieces changed.',true);}
 finally{globalThis.clearTimeout(timer);typedBusy=false;typedController=null;$('command-form').querySelector('button').disabled=false;$('listen').disabled=!voiceRecorder;}
}
commandInput.oninput=()=>{voiceDraft=null;};
$('command-form').onsubmit=e=>{
 e.preventDefault();
 if(voiceDraft!==null&&commandInput.value===stripVoicePunctuation(voiceDraft))execute(voiceDraft,activeColor,{spoken:true});
 else execute(commandInput.value);
};
document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{voiceDraft=null;commandInput.value=b.dataset.command;execute(b.dataset.command);});
$('help').onclick=()=>$('guide').showModal();$('close-guide').onclick=()=>$('guide').close();$('guide').onclick=e=>{if(e.target===$('guide')){const r=$('guide').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('guide').close();}};
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restore(e.shiftKey?'redo':'undo');}});
function voiceError(error){
 const message=error.name==='NotAllowedError'?'Microphone access was denied. Allow this site to use your microphone in browser settings.':error.name==='NotFoundError'?'No microphone found. Connect one and try again.':error.name==='TimeoutError'?'Transcription timed out. Please try again.':error.message;
 $('voice-state').textContent=voiceRecorder?.state==='interpreting'&&voiceDraft!==null?'Heard: “'+voiceDraft+'”':message;
 feedback(message+' No pieces changed.',true);
}
if(navigator.mediaDevices?.getUserMedia&&window.MediaRecorder){
 voiceRecorder=new VoiceRecorder({
  getUserMedia:()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}),
  Recorder:window.MediaRecorder,
  async ready(){const response=await fetch('/api/transcribe',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Voice service is unavailable. Please try again later.');const config=await response.json();if(!config.ready)throw Error('Groq voice setup is pending. Typed commands are available below.');},
  async transcribe(blob,signal){const form=new FormData();form.set('audio',blob,blob.type.includes('mp4')?'command.mp4':'command.webm');const response=await fetch('/api/transcribe',{method:'POST',body:form,signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Transcription failed.');return data.text;},
  interpret(text,color,signal){
   voiceDraft=text;
   commandInput.value=stripVoicePunctuation(text);
   $('voice-state').textContent='Heard: “'+text+'” · interpreting placement…';
   return interpretText(text,color,signal,{spoken:true});
  },
  onTranscript(text,color,result){$('voice-state').textContent='Heard: “'+text+'”';applyInterpretation(result,text);},
  onError:voiceError,
  onState(mode,capture){
   $('listen').disabled=false;
   $('listen').classList.toggle('active',mode==='recording');$('listen').setAttribute('aria-pressed',String(mode==='recording'));
   $('listen-label').textContent={idle:'Start recording',recording:'Stop recording',requesting:'Cancel',stopping:'Cancel',transcribing:'Cancel transcription',interpreting:'Cancel interpretation'}[mode];
   if(mode==='requesting'){
    if(voiceDraft!==null&&commandInput.value===stripVoicePunctuation(voiceDraft))commandInput.value='';
    voiceDraft=null;
    $('voice-state').textContent='Opening microphone…';
   }
   if(mode==='recording')$('voice-state').textContent=capture.shortcut ? 'Recording… release R to finish.' : 'Recording… click Stop recording when done.';
   if(mode==='stopping')$('voice-state').textContent='Finishing the recording…';
   if(mode==='interpreting')$('voice-state').textContent='Interpreting your placement…';
   if(mode==='transcribing')$('voice-state').textContent='Groq is transcribing your command…';
   if(mode==='idle'&&$('voice-state').textContent==='Opening microphone…')$('voice-state').textContent='Hold R until recording starts, then speak.';
   updateColorUI();
  }
 });
 $('listen').onclick=()=>{if(voiceRecorder.state==='idle')voiceRecorder.start(activeColor);else if(voiceRecorder.state==='recording')voiceRecorder.finish();else{voiceRecorder.cancel();$('voice-state').textContent='Cancelled. Ready to record again.';}};
 fetch('/api/transcribe').then(r=>r.ok?r.json():Promise.reject()).then(config=>{if(voiceRecorder.state==='idle')$('voice-state').textContent=config.ready?'Groq Whisper Large V3 · ready to record.':'Groq voice setup is pending. Typed commands are available below.';}).catch(()=>{if(voiceRecorder.state==='idle')$('voice-state').textContent='Voice service unavailable. Typed commands are available below.';});
}else{$('listen').disabled=true;$('listen-label').textContent='Recording unavailable';$('voice-state').textContent='Open this site in a browser with microphone recording support.';}
document.addEventListener('keydown', event => {
 if (event.key.toLowerCase() !== recordShortcut || event.repeat || event.isComposing ||
     event.ctrlKey || event.metaKey || event.altKey || $('guide').open ||
     event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
 if (typedBusy || voiceRecorder?.state !== 'idle') return;
 event.preventDefault();
 voiceRecorder.start(activeColor, recordShortcut);
});
document.addEventListener('keyup', event => {
 if (event.key.toLowerCase() === recordShortcut) releaseRecordShortcut();
});
function releaseRecordShortcut() {
 voiceRecorder?.release(recordShortcut);
}
window.addEventListener('blur',releaseRecordShortcut);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseRecordShortcut();});
window.addEventListener('pagehide',()=>{voiceRecorder?.dispose();typedController?.abort();});updateColorUI();render();
