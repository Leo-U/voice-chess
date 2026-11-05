import assert from 'node:assert/strict';
import {interpret,validateInterpretation,PLACEMENT_PROMPT,INTERPRET_MODEL} from './server/interpret.mjs';
const good={status:'placements',nextColor:'unchanged',placements:[{piece:'king',square:'e5',color:'selected'},{piece:'bishop',square:'c3',color:'white'}],message:'Two placements.'};
assert.deepEqual(validateInterpretation(good,'black').commands,[{type:'place',piece:'k',square:'e5'},{type:'place',piece:'B',square:'c3'}]);
for(const p of [{piece:'dragon',square:'e5',color:'selected'},{piece:'king',square:'e9',color:'selected'},{piece:'king',square:'a1',color:'red'}])assert.throws(()=>validateInterpretation({...good,placements:[p]},'white'));
assert.throws(()=>validateInterpretation({...good,placements:[good.placements[0],{piece:'queen',square:'e5',color:'selected'}]},'white'));
assert.throws(()=>validateInterpretation({...good,status:'clarification'},'white'));
assert.deepEqual(validateInterpretation({status:'clarification',placements:[],message:'Which square?',nextColor:'unchanged'},'white').commands,[]);
assert.equal(validateInterpretation(good, null).status, 'clarification');
assert.deepEqual(validateInterpretation(good, null).commands, []);
const switchOnly = {status:'color', placements:[], message:'Black selected.', nextColor:'black'};
assert.deepEqual(validateInterpretation(switchOnly, null), {
 status:'color', commands:[], message:'Black selected.', nextColor:'black'
});
assert.throws(() => validateInterpretation({...switchOnly, nextColor:'unchanged'}, null));
const mixed = {status:'placements', nextColor:'white', message:'Two colors.', placements:[
 {piece:'king', square:'a5', color:'black'},
 {piece:'pawn', square:'d2', color:'black'},
 {piece:'pawn', square:'d3', color:'black'},
 {piece:'pawn', square:'d5', color:'black'},
 {piece:'queen', square:'e4', color:'white'}
]};
assert.deepEqual(validateInterpretation(mixed, null).commands.map(({piece,square}) => piece+square), ['ka5','pd2','pd3','pd5','Qe4']);
assert.equal(validateInterpretation(mixed, null).nextColor, 'white');
assert.equal(validateInterpretation({...mixed, nextColor:'unchanged'}, 'black').nextColor, null);
assert.equal(validateInterpretation({status:'clarification', placements:[], message:'Which square?', nextColor:'black'}, null).nextColor, null);
const request=(body={text:'I think we should have a king over on e5 and stick a bishop on c3.',color:'black'},origin='https://chess.example')=>new Request('https://chess.example/api/interpret',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
let calls=0;
const mocked=async(url,init)=>{calls++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');const b=JSON.parse(init.body);assert.equal(b.model,INTERPRET_MODEL);assert.equal(b.messages[0].content,PLACEMENT_PROMPT);assert.equal(b.response_format.json_schema.strict,true);assert.equal(JSON.parse(b.messages[1].content).selectedColor,'black');return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(good)}}]});};
assert.equal((await interpret(request(),{},mocked)).status,503);
assert.equal((await interpret(request(undefined,'https://other.example'),{GROQ_API_KEY:'test'},mocked)).status,403);
assert.equal((await interpret(request({text:'king e5',color:'red'}),{GROQ_API_KEY:'test'},mocked)).status,400);
const ok=await interpret(request(),{GROQ_API_KEY:'test'},mocked);assert.equal(ok.status,200);assert.equal((await ok.json()).commands[0].piece,'k');assert.equal(calls,1);
const mockResult = result => async (_url, init) => {
 assert.equal(JSON.parse(JSON.parse(init.body).messages[1].content).selectedColor, null);
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]});
};
const switchResponse = await interpret(request({text:"Let's do black next.",color:null}), {GROQ_API_KEY:'test'}, mockResult(switchOnly));
assert.equal(switchResponse.status, 200);
assert.equal((await switchResponse.json()).nextColor, 'black');
const namedPiece = {status:'placements', nextColor:'unchanged', message:'White queen.', placements:[{piece:'queen',square:'e4',color:'white'}]};
const namedResponse = await interpret(request({text:'Put a white queen on e4.',color:null}), {GROQ_API_KEY:'test'}, mockResult(namedPiece));
assert.deepEqual((await namedResponse.json()).commands, [{type:'place',piece:'Q',square:'e4'}]);
for(const [response,status] of [[new Response('',{status:429}),502],[Response.json({choices:[{finish_reason:'length',message:{content:JSON.stringify(good)}}]}),502],[Response.json({choices:[{finish_reason:'stop',message:{content:'not json'}}]}),502]])assert.equal((await interpret(request(),{GROQ_API_KEY:'test'},async()=>response)).status,status);
assert.equal((await interpret(request(),{GROQ_API_KEY:'test'},async()=>{throw Error('offline');})).status,504);
console.log('Interpretation request, structured output, selected color, validation, ambiguity, limits and failure checks passed.');
