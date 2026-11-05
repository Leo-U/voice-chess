const MAX_AUDIO_BYTES=8*1024*1024;
const JSON_HEADERS={'Content-Type':'application/json','Cache-Control':'no-store'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
export async function transcribe(request,env,fetchImpl=fetch){
 if(request.method==='GET')return json({ready:!!env.GROQ_API_KEY,model:'whisper-large-v3'});
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)return json({error:'Use the recorder on this site.'},403);
 if(!env.GROQ_API_KEY)return json({error:'Model voice input is not connected yet. The site owner needs to complete Groq setup.'},503);
 if(Number(request.headers.get('Content-Length'))>MAX_AUDIO_BYTES+65536)return json({error:'Recording is too large. Please record under 60 seconds.'},413);
 let form;
 try{form=await request.formData();}catch{return json({error:'Invalid audio upload.'},400);}
 const audio=form.get('audio');
 if(!audio||typeof audio==='string'||!audio.size)return json({error:'No audio recorded. Please try again.'},400);
 if(audio.size>MAX_AUDIO_BYTES)return json({error:'Recording is too large. Please record under 60 seconds.'},413);
 if(!/^(audio\/(webm|mp4|mpeg|wav|ogg|x-m4a)|video\/webm)(;|$)/.test(audio.type))return json({error:'Unsupported audio format.'},415);
 const body=new FormData();
 body.set('file',audio,audio.type.includes('mp4')?'command.mp4':audio.type.includes('ogg')?'command.ogg':audio.type.includes('wav')?'command.wav':'command.webm');
 body.set('model','whisper-large-v3');
 body.set('prompt','Chess coordinates and piece placement. King e5. E5 king. Knight f3. Rook a1. Bishop b4. Queen d8. Pawn c6. White king e1. Black king e8. Files a, b, c, d, e, f, g, h. Ranks 1, 2, 3, 4, 5, 6, 7, 8.');
 body.set('language','en');
 body.set('temperature','0');
 body.set('response_format','json');
 let response;
 try{response=await fetchImpl('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${env.GROQ_API_KEY}`},body,signal:AbortSignal.timeout(45000)});}catch{return json({error:'Transcription timed out or could not connect. Please try again.'},504);}
 if(!response.ok){let error=response.status===401?'The model connection needs a valid API key.':response.status===429?'The model service is at its usage limit. Please try again later.':'The model could not transcribe this recording. Please try again.';return json({error},502);}
 let data;try{data=await response.json();}catch{return json({error:'Invalid transcription response. Please try again.'},502);}
 if(typeof data.text!=='string'||!data.text.trim())return json({error:'No speech recognized. Please try again closer to the microphone.'},422);
 return json({text:data.text.trim()});
}
