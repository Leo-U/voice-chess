(function(root){
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function parseFen(fen){const parts=fen.trim().split(/\s+/);if(parts.length!==6)throw Error('FEN needs all six fields.');const [placement,turn,castles,ep,half,full]=parts;const rows=placement.split('/');if(rows.length!==8)throw Error('FEN needs eight ranks.');let board={};rows.forEach((row,i)=>{let file=0;for(const ch of row){if(/[1-8]/.test(ch))file+=Number(ch);else if(/[prnbqkPRNBQK]/.test(ch)){if(file>7)throw Error('Too many squares in a rank.');board['abcdefgh'[file++]+(8-i)]=ch;}else throw Error('Unknown piece in FEN.');}if(file!==8)throw Error('Each rank must contain eight squares.');});if(!/^[wb]$/.test(turn))throw Error('Side to move must be w or b.');if(!/^(?:-|K?Q?k?q?)$/.test(castles))throw Error('Invalid castling rights.');if(!/^(?:-|[a-h][36])$/.test(ep))throw Error('En passant must be - or a square on rank 3 or 6.');if(!/^\d+$/.test(half)||!/^\d+$/.test(full)||Number(full)<1)throw Error('Invalid move counters.');return {board,turn,castles,ep,half:Number(half),full:Number(full)};}
function toFen(s){let rows=[];for(let r=8;r>=1;r--){let row='',empty=0;for(let f of 'abcdefgh'){let p=s.board[f+r];if(p){if(empty){row+=empty;empty=0;}row+=p;}else empty++;}if(empty)row+=empty;rows.push(row);}return `${rows.join('/')} ${s.turn} ${s.castles||'-'} ${s.ep} ${s.half} ${s.full}`;}
function normalize(text){let t=text.toLowerCase().replace(/[.,!?]/g,' ').replace(/\bnight\b/g,'knight');const files={alpha:'a',alfa:'a',bravo:'b',charlie:'c',delta:'d',echo:'e',foxtrot:'f',golf:'g',hotel:'h'};const nums={one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8'};t=t.replace(/\b(alpha|alfa|bravo|charlie|delta|echo|foxtrot|golf|hotel)\b/g,w=>files[w]);t=t.replace(/\b(one|two|three|four|five|six|seven|eight)\b/g,w=>nums[w]);t=t.replace(/\b([a-h])\s+([1-8])\b/g,'$1$2');return t.replace(/\s+/g,' ').trim();}
function parseCommand(text,defaultColor='white'){const t=normalize(text);if(/^(undo|redo|flip(?: board)?|clear board|(?:reset|starting|start)(?: position| board)?)$/.test(t)){return {type:t.startsWith('flip')?'flip':t==='clear board'?'clear':t==='undo'||t==='redo'?t:'start'};}let m=t.match(/^(?:(?:white|black) (?:king|queen|rook|bishop|knight|pawn) )?(?:(?:move|from) )?([a-h][1-8]) (?:to|on) ([a-h][1-8])$/);if(m)return {type:'move',from:m[1],to:m[2]};m=t.match(/^(?:clear|remove|erase|delete)(?: (?:the )?piece (?:on|at|from))? ([a-h][1-8])$/);if(m)return {type:'remove',square:m[1]};m=t.match(/^(?:(?:place|put|add) )?(?:a |the )?(?:(white|black) )?(king|queen|rook|bishop|knight|pawn)(?: (?:on|at|to))? ([a-h][1-8])$/);
 if(m)return placement(m[2],m[3],m[1]||defaultColor);
 m=t.match(/^([a-h][1-8]) (?:(white|black) )?(king|queen|rook|bishop|knight|pawn)$/);
 if(m)return placement(m[3],m[1],m[2]||defaultColor);
 throw Error('Try “king e5”, “e5 king”, or “clear e4”.');}
function placement(name,square,color){const piece={king:'k',queen:'q',rook:'r',bishop:'b',knight:'n',pawn:'p'}[name];return {type:'place',piece:color==='white'?piece.toUpperCase():piece,square};}
function parseCommands(text,defaultColor='white'){
 const normalized=normalize(text).replace(/[;:\n–—-]/g,' ').replace(/\s+/g,' ').trim();
 if(/^[a-h][1-8](?:\s+[a-h][1-8])*$/.test(normalized)){
  const coords=normalized.split(' ');
  if(coords.length%2)throw Error('Read coordinates in pairs, for example “e2, e4”. A destination is missing.');
  const moves=[];for(let i=0;i<coords.length;i+=2)moves.push({type:'move',from:coords[i],to:coords[i+1]});return moves;
 }
 return text.split(/\s+(?:and(?: then)?|then)\s+|[.;,\n]+/i).filter(t=>t.trim()).map(t=>parseCommand(t,defaultColor));
}
function applyEdits(state,commands){
 const board={...state.board};
 for(const c of commands){
  if(c.type==='place')board[c.square]=c.piece;
  else if(c.type==='remove')delete board[c.square];
  else if(c.type==='move'){
   if(c.from===c.to)throw Error('Choose a different destination square.');
   if(!board[c.from])throw Error('There is no piece on '+c.from+'.');
   board[c.to]=board[c.from];delete board[c.from];
  }else throw Error('Use board commands individually.');
 }
 state.board=board;return state;
}
root.ChessEditor={START,parseFen,toFen,parseCommand,parseCommands,applyEdits};
})(typeof window!=='undefined'?window:globalThis);
