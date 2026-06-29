import { useState, useReducer, createContext, useContext, useEffect, useRef } from "react";

// ── Constants ──────────────────────────────────────────────────────────────
const STATES = { LOCKED:"LOCKED", AVAILABLE:"AVAILABLE", COMPLETED:"COMPLETED", RESTORED:"RESTORED" };
const BINARY_LETTERS = ["B","I","N","A","R","Y"];
const PUZZLE_ORDER   = ["computer","server","filing","archive","safe","door"];

// ── Data ───────────────────────────────────────────────────────────────────
const MISSIONS_DATA = [
  { id:"m1", title:"Restore the Main Computer",   puzzleId:"computer" },
  { id:"m2", title:"Power the Server Rack",        puzzleId:"server"   },
  { id:"m3", title:"Recover the Binary Database",  puzzleId:"filing"   },
  { id:"m4", title:"Restore the Data Archive",     puzzleId:"archive"  },
  { id:"m5", title:"Decode the Security Safe",     puzzleId:"safe"     },
  { id:"m6", title:"Unlock the Exit Door",         puzzleId:"door"     },
];

const INVENTORY_DATA = {
  placeValue: {
    id:"placeValue", title:"Binary Place Value File", icon:"🃏",
    content:(
      <div>
        <p style={{marginBottom:8,color:"#94a3b8",fontSize:13}}>Use this file to read binary numbers. Each position has a value:</p>
        <div style={{display:"flex",gap:4,justifyContent:"center",margin:"12px 0"}}>
          {["16","8","4","2","1"].map(v=>(
            <div key={v} style={{background:"#1e3a5f",border:"1px solid #3b82f6",borderRadius:6,padding:"8px 12px",textAlign:"center",minWidth:40}}>
              <div style={{color:"#93c5fd",fontSize:11,marginBottom:2}}>bit</div>
              <div style={{color:"#fff",fontWeight:700,fontSize:18}}>{v}</div>
            </div>
          ))}
        </div>
        <p style={{fontSize:13,color:"#94a3b8"}}>Add the values under each <strong>1</strong> to get the decimal number.<br/>Example: <code>10110</code> → 16+4+2 = <strong>22</strong></p>
      </div>
    )
  },
  alphabet: {
    id:"alphabet", title:"Alphabet Decoder File", icon:"🔤",
    content:(
      <div>
        <p style={{marginBottom:8,color:"#94a3b8",fontSize:13}}>Binary → Letter reference:</p>
        <p style={{marginBottom:8,color:"#475569",fontSize:11,fontStyle:"italic"}}>Note: This is a simplified version. Real computers use ASCII encoding.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3}}>
          {Array.from({length:26},(_,i)=>{
            const n=i+1, b=n.toString(2).padStart(5,"0");
            return (
              <div key={i} style={{background:"#1e3a5f",borderRadius:4,padding:"4px 2px",textAlign:"center"}}>
                <div style={{color:"#fff",fontWeight:700,fontSize:13}}>{String.fromCharCode(65+i)}</div>
                <div style={{color:"#93c5fd",fontSize:10}}>{b}</div>
              </div>
            );
          })}
        </div>
      </div>
    )
  },
};

const PUZZLE_HINTS = {
  computer: ["Look at the numbers on the screen. Binary uses only two digits.","Remove any digit that isn't 0 or 1 from the sequence.","The sequence 1,0,1,0 uses only 0s and 1s — that's binary!"],
  server:   ["Each switch is either ON (1) or OFF (0).","The pattern you need is: 1=ON, 0=OFF, 1=ON, 1=ON, 0=OFF","Try the pattern: ON OFF ON ON OFF — that's 10110 in binary."],
  filing:   ["Use your Place Value File from system files to help read each binary number.","For 10110: the 1s are in positions 16, 4, 2. Add them up!","10110=22, 01101=13, 00111=7"],
  archive:  ["Look at the place values: 16, 8, 4, 2, 1. Which ones add up to 18?","Try turning on the 16 position. That's 16 so far — you need 2 more.","16+2=18. Turn on positions 16 and 2, leave the rest as 0."],
  safe:     ["Use your Alphabet Decoder File from system files.","Each 5-bit binary number is a position in the alphabet (A=1, B=2...).","00011=3=C, 01111=15=O, 00100=4=D, 00101=5=E → CODE"],
  door:     ["Think about which items exist inside a computer. Can you hold a digital file in your hand?","Physical objects like books and apples can't be stored on a computer. Digital files can.","The 6 digital items are: Text, Picture, Music, Video, Video Game, and Email."],
  __exit__: ["The word describes the number system you've been using all game.","It starts with the letter B.","You've been converting between decimal and this system all along."],
};

// ── Helpers ────────────────────────────────────────────────────────────────
function shuffleArray(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

function makeInitialState() {
  const shuffled=shuffleArray(BINARY_LETTERS);
  const letterMap={};
  PUZZLE_ORDER.forEach((id,i)=>{letterMap[id]=shuffled[i];});
  const hintProgress={};
  [...PUZZLE_ORDER,"__exit__"].forEach(id=>{hintProgress[id]=-1;});
  return {
    roomObjects:{computer:STATES.AVAILABLE,server:STATES.AVAILABLE,filing:STATES.AVAILABLE,archive:STATES.AVAILABLE,safe:STATES.AVAILABLE,door:STATES.AVAILABLE},
    missions:MISSIONS_DATA.map(m=>({...m,completed:false})),
    inventory:Object.keys(INVENTORY_DATA),
    letterMap, collectedLetters:[], completedPuzzles:[], activePuzzle:null,
    exitUnlocked:false, hintProgress,
    score:100, attempts:0, hintsRemaining:12, hintsUsed:0,
    gameComplete:false, notifications:[],
  };
}

// ── Reducer ────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch(action.type) {
    case "OPEN_PUZZLE":  return {...state,activePuzzle:action.puzzleId};
    case "CLOSE_PUZZLE": return {...state,activePuzzle:null};
    case "WRONG_ANSWER": return {...state,score:Math.max(0,state.score-2),attempts:state.attempts+1};
    case "USE_HINT": {
      const pid=action.puzzleId, ph=PUZZLE_HINTS[pid]||[], cur=state.hintProgress[pid]??-1;
      if(cur>=ph.length-1) return state;
      return {...state,score:Math.max(0,state.score-5),hintsRemaining:Math.max(0,state.hintsRemaining-1),hintsUsed:state.hintsUsed+1,hintProgress:{...state.hintProgress,[pid]:cur+1}};
    }
    case "COMPLETE_PUZZLE": {
      const letter=state.letterMap[action.puzzleId]||null;
      const newLetters=letter&&!state.collectedLetters.includes(letter)?[...state.collectedLetters,letter]:state.collectedLetters;
      const newRoomObjects={...state.roomObjects,[action.puzzleId]:STATES.COMPLETED};
      const newMissions=state.missions.map(m=>m.puzzleId===action.puzzleId?{...m,completed:true}:m);
      const newCompleted=[...state.completedPuzzles,action.puzzleId];
      const allDone=newCompleted.length>=6;
      if(allDone) Object.keys(newRoomObjects).forEach(k=>newRoomObjects[k]=STATES.RESTORED);
      return {...state,roomObjects:newRoomObjects,missions:newMissions,collectedLetters:newLetters,completedPuzzles:newCompleted,activePuzzle:null,exitUnlocked:allDone,notifications:[...state.notifications,{id:Date.now(),text:action.notification||"Puzzle solved!",type:"success"}]};
    }
    case "SUBMIT_PASSWORD":
      if(action.password.toUpperCase()==="BINARY") return {...state,gameComplete:true,activePuzzle:null};
      return {...state,score:Math.max(0,state.score-2),attempts:state.attempts+1,notifications:[...state.notifications,{id:Date.now(),text:"Incorrect password. Try again.",type:"error"}]};
    case "ADD_NOTIFICATION": return {...state,notifications:[...state.notifications,{id:Date.now(),...action.payload}]};
    case "REMOVE_NOTIFICATION": return {...state,notifications:state.notifications.filter(n=>n.id!==action.id)};
    case "RESET": return makeInitialState();
    default: return state;
  }
}

const GameCtx=createContext(null);
const useGame=()=>useContext(GameCtx);
function usePuzzleLetter(puzzleId){const {state}=useGame();return state.letterMap?.[puzzleId]||"?";}

// ── Notifications ──────────────────────────────────────────────────────────
function Notifications({notifications,dispatch}) {
  useEffect(()=>{
    notifications.forEach(n=>{const t=setTimeout(()=>dispatch({type:"REMOVE_NOTIFICATION",id:n.id}),3000);return()=>clearTimeout(t);});
  },[notifications]);
  return (
    <div style={{position:"fixed",top:16,right:16,zIndex:1000,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {notifications.map(n=>(
        <div key={n.id} style={{background:n.type==="success"?"#065f46":"#1e3a5f",color:"#fff",padding:"10px 16px",borderRadius:8,fontSize:14,boxShadow:"0 4px 12px rgba(0,0,0,0.4)",border:`1px solid ${n.type==="success"?"#10b981":"#3b82f6"}`,maxWidth:280,animation:"slideIn 0.3s ease"}}>
          {n.text}
        </div>
      ))}
    </div>
  );
}

// ── Shared UI ──────────────────────────────────────────────────────────────
function Modal({title,onClose,children}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:12}}>
      <div style={{background:"#0f172a",border:"1px solid #1e40af",borderRadius:12,width:"100%",maxWidth:520,maxHeight:"88vh",overflowY:"auto",boxShadow:"0 0 40px rgba(59,130,246,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid #1e293b",position:"sticky",top:0,background:"#0f172a",zIndex:1}}>
          <h2 style={{color:"#7dd3fc",fontSize:15,fontWeight:600,margin:0}}>{title}</h2>
          <button onClick={onClose} style={{color:"#64748b",background:"none",border:"none",cursor:"pointer",fontSize:24,lineHeight:1,padding:"0 4px",minWidth:36,minHeight:36,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{padding:16}}>{children}</div>
      </div>
    </div>
  );
}

function ErrMsg({msg,attempts}) {
  const [flash,setFlash]=useState(false);
  useEffect(()=>{
    if(!msg) return;
    setFlash(true);
    const t=setTimeout(()=>setFlash(false),400);
    return()=>clearTimeout(t);
  },[msg,attempts]);
  if(!msg) return null;
  return (
    <div style={{marginBottom:12}}>
      <div style={{color:"#fca5a5",fontSize:13,padding:"8px 12px",background:flash?"#4a0a0a":"#2d0a0a",borderRadius:6,transition:"background 0.15s",border:`1px solid ${flash?"#ef4444":"transparent"}`}}>{msg}</div>
      {attempts>=2&&(
        <div style={{marginTop:6,padding:"7px 12px",background:"#1a1200",border:"1px solid #78350f",borderRadius:6,color:"#fbbf24",fontSize:12,display:"flex",alignItems:"center",gap:8}}>
          <span>💡</span><span>Having trouble? A hint might help.</span>
        </div>
      )}
    </div>
  );
}

function HintDisplay({puzzleId}) {
  const {state}=useGame();
  const ph=PUZZLE_HINTS[puzzleId]||[];
  const idx=state.hintProgress[puzzleId]??-1;
  if(idx<0) return null;
  return (
    <div style={{marginBottom:12}}>
      {ph.slice(0,idx+1).map((h,i)=>(
        <div key={i} style={{color:"#fbbf24",fontSize:13,marginBottom:6,padding:"8px 12px",background:"#1a1200",borderRadius:6}}>💡 {h}</div>
      ))}
    </div>
  );
}

function HintButton({puzzleId}) {
  const {state,dispatch}=useGame();
  const ph=PUZZLE_HINTS[puzzleId]||[];
  const idx=state.hintProgress[puzzleId]??-1;
  if(idx>=ph.length-1||state.hintsRemaining<=0) return null;
  return (
    <button onClick={()=>dispatch({type:"USE_HINT",puzzleId})}
      style={{padding:"10px 14px",borderRadius:6,background:"#1a1200",border:"1px solid #78350f",color:"#fbbf24",cursor:"pointer",fontSize:13,minHeight:44}}>
      💡 Hint ({state.hintsRemaining} left)
    </button>
  );
}

function SubmitRow({puzzleId,onSubmit}) {
  return (
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <HintButton puzzleId={puzzleId}/>
      <button onClick={onSubmit} style={{padding:"10px 18px",borderRadius:6,background:"#1d4ed8",border:"none",color:"#fff",cursor:"pointer",fontSize:14,fontWeight:600,minHeight:44}}>Submit</button>
    </div>
  );
}

function ReferenceStrip({itemId}) {
  const [open,setOpen]=useState(false);
  const item=INVENTORY_DATA[itemId];
  if(!item) return null;
  return (
    <div style={{marginBottom:14,borderRadius:8,border:`1px solid ${open?"#1d4ed8":"#1e293b"}`,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px",background:open?"#0a1628":"#0f172a",border:"none",cursor:"pointer",textAlign:"left",minHeight:48}}>
        <span style={{fontSize:16}}>{item.icon}</span>
        <span style={{color:"#7dd3fc",fontSize:12,fontWeight:600,flex:1}}>{item.title}</span>
        <span style={{color:"#475569",fontSize:12,display:"inline-block",transform:open?"rotate(180deg)":"none"}}>▼</span>
      </button>
      {open&&<div style={{padding:"10px 14px",background:"#070d1a",borderTop:"1px solid #1e293b"}}>{item.content}</div>}
    </div>
  );
}

function InventoryModal({item,onClose}) {
  const inv=INVENTORY_DATA[item];
  if(!inv) return null;
  return <Modal title={inv.title} onClose={onClose}><div style={{color:"#e2e8f0"}}>{inv.content}</div></Modal>;
}

// ── Touch-safe draggable item (for Server 08 and word scramble) ────────────
function useTouchDrag({onDrop, onDropZone}) {
  // Returns props to spread onto draggable elements and drop zones
  // Uses pointer events which work on both mouse and touch
  return { pointerEvents: true };
}

// ── Puzzle 01 ──────────────────────────────────────────────────────────────
function PuzzleComputer({onClose}) {
  const {dispatch}=useGame();
  const letter=usePuzzleLetter("computer");
  const sequence=["7","1","4","0","6","8","1","3","0","5","2","1","9"];
  const [removed,setRemoved]=useState(new Set());
  const [msg,setMsg]=useState("");
  const [tries,setTries]=useState(0);
  const toggle=i=>setRemoved(prev=>{const n=new Set(prev);n.has(i)?n.delete(i):n.add(i);return n;});
  const submit=()=>{
    const active=sequence.filter((_,i)=>!removed.has(i));
    const allBin=active.every(v=>v==="0"||v==="1");
    const noneWrongRemoved=sequence.every((v,i)=>(v==="0"||v==="1")?!removed.has(i):removed.has(i));
    if(allBin&&noneWrongRemoved){dispatch({type:"COMPLETE_PUZZLE",puzzleId:"computer",notification:`✓ Server 01 restored! You earned the letter ${letter}.`});}
    else if(!allBin){dispatch({type:"WRONG_ANSWER"});setTries(t=>t+1);setMsg("Some non-binary digits are still active. Remove every digit that isn't 0 or 1.");}
    else{dispatch({type:"WRONG_ANSWER"});setTries(t=>t+1);setMsg("You've removed a 0 or 1 — those belong in binary! Add them back.");}
  };
  return (
    <Modal title="Server 01 — Repair the Boot Sequence" onClose={onClose}>
      <p style={{color:"#94a3b8",fontSize:14,marginBottom:16}}>The boot sequence is corrupted. Remove every digit that isn't a 0 or 1.</p>
      <div style={{background:"#0f172a",borderRadius:8,padding:16,marginBottom:16,textAlign:"center"}}>
        <div style={{color:"#ef4444",fontSize:11,marginBottom:12}}>⚠ BOOT SEQUENCE ERROR — NON-BINARY CHARACTERS DETECTED</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
          {sequence.map((v,i)=>{
            const isRm=removed.has(i);
            return (
              <button key={i} onClick={()=>toggle(i)} style={{width:48,height:48,borderRadius:6,border:`2px solid ${isRm?"#7f1d1d":"#3b82f6"}`,background:isRm?"#3b0f0f":"#1e3a5f",color:isRm?"#ef444488":"#7dd3fc",fontSize:20,fontWeight:700,cursor:"pointer",fontFamily:"monospace",transition:"all 0.15s",textDecoration:isRm?"line-through":"none",opacity:isRm?0.6:1,minWidth:48,minHeight:48}}>
                {v}
              </button>
            );
          })}
        </div>
        <div style={{color:"#475569",fontSize:12,marginTop:10}}>Tap to remove. Tap again to restore.</div>
      </div>
      <div style={{color:"#64748b",fontSize:13,marginBottom:16,padding:"8px 12px",background:"#0f172a",borderRadius:6}}>
        Active sequence: <span style={{color:"#7dd3fc",fontFamily:"monospace",fontWeight:700,letterSpacing:2}}>{sequence.filter((_,i)=>!removed.has(i)).join("")||"—"}</span>
      </div>
      <ErrMsg msg={msg} attempts={tries}/>
      <HintDisplay puzzleId="computer"/>
      <SubmitRow puzzleId="computer" onSubmit={submit}/>
    </Modal>
  );
}

// ── Puzzle 02 ──────────────────────────────────────────────────────────────
function PuzzleServer({onClose}) {
  const {dispatch}=useGame();
  const letter=usePuzzleLetter("server");
  const [switches,setSwitches]=useState([false,false,false,false,false]);
  const [msg,setMsg]=useState("");
  const [tries,setTries]=useState(0);
  const target=[1,0,1,1,0];
  const toggle=i=>setSwitches(s=>{const n=[...s];n[i]=!n[i];return n;});
  const submit=()=>{
    if(switches.map(s=>s?1:0).join("")==="10110"){dispatch({type:"COMPLETE_PUZZLE",puzzleId:"server",notification:`✓ Server 02 restored! You earned the letter ${letter}.`});}
    else{dispatch({type:"WRONG_ANSWER"});setTries(t=>t+1);setMsg("Incorrect pattern. Remember: 1 means ON, 0 means OFF. Try again.");}
  };
  return (
    <Modal title="Server 02 — Restore Power Switches" onClose={onClose}>
      <p style={{color:"#94a3b8",fontSize:14,marginBottom:16}}>Set the switches to match the boot code: 10110</p>
      <div style={{background:"#0f172a",borderRadius:8,padding:16,marginBottom:16}}>
        <div style={{color:"#94a3b8",fontSize:12,marginBottom:12,textAlign:"center"}}>Boot code: <span style={{color:"#7dd3fc",fontFamily:"monospace",fontWeight:700}}>10110</span></div>
        <div style={{display:"flex",gap:12,justifyContent:"center"}}>
          {switches.map((on,i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <div style={{fontSize:11,color:"#64748b"}}>SW{i+1}</div>
              <div style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace"}}>{target[i]}</div>
              <button onClick={()=>toggle(i)} style={{width:48,height:76,borderRadius:8,border:`2px solid ${on?"#10b981":"#374151"}`,background:on?"#064e3b":"#1f2937",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"6px 0",transition:"all 0.2s",minWidth:48}}>
                <div style={{width:24,height:8,borderRadius:4,background:on?"#34d399":"#4b5563"}}/>
                <div style={{width:16,height:28,borderRadius:4,background:on?"#10b981":"#374151"}}/>
                <div style={{color:on?"#34d399":"#6b7280",fontSize:10,fontWeight:700}}>{on?"ON":"OFF"}</div>
              </button>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",marginTop:12,fontFamily:"monospace",color:"#7dd3fc",fontSize:16,letterSpacing:4}}>
          {switches.map(s=>s?"1":"0").join("")}
        </div>
      </div>
      <ErrMsg msg={msg} attempts={tries}/>
      <HintDisplay puzzleId="server"/>
      <SubmitRow puzzleId="server" onSubmit={submit}/>
    </Modal>
  );
}

// ── Puzzle 03 ──────────────────────────────────────────────────────────────
function PuzzleFiling({onClose}) {
  const {dispatch}=useGame();
  const letter=usePuzzleLetter("filing");
  const [ans,setAns]=useState(["","",""]);
  const [msg,setMsg]=useState("");
  const [tries,setTries]=useState(0);
  const placeValues=[16,8,4,2,1];
  const rows=[{bits:[1,0,1,1,0],answer:22},{bits:[0,1,1,0,1],answer:13},{bits:[0,0,1,1,1],answer:7}];
  const submit=()=>{
    if(ans[0].trim()==="22"&&ans[1].trim()==="13"&&ans[2].trim()==="7"){dispatch({type:"COMPLETE_PUZZLE",puzzleId:"filing",notification:`✓ Server 03 restored! You earned the letter ${letter}.`});}
    else{dispatch({type:"WRONG_ANSWER"});setTries(t=>t+1);setMsg("One or more answers are incorrect. Use the place values to check your work.");}
  };
  return (
    <Modal title="Server 03 — Decode the Binary Database" onClose={onClose}>
      <div style={{background:"#0f172a",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
        <div style={{color:"#94a3b8",fontSize:13,marginBottom:14,lineHeight:1.6}}>Binary numbers are stored in the database. Convert each one to decimal to recover the data.</div>
        <ReferenceStrip itemId="placeValue"/>
        <div style={{borderTop:"1px solid #1e293b",margin:"12px 0"}}/>
        <div style={{color:"#fbbf24",fontSize:11,fontWeight:700,fontFamily:"monospace",marginBottom:12}}>Example</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:6}}>
          {placeValues.map(v=><div key={v} style={{width:44,textAlign:"center",color:"#7dd3fc",fontSize:13,fontWeight:700,fontFamily:"monospace"}}>{v}</div>)}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:10}}>
          {[0,1,0,1,1].map((b,i)=>(
            <div key={i} style={{width:44,height:36,borderRadius:6,border:`2px solid ${b?"#22d3ee":"#1e293b"}`,background:b?"#0a2a4a":"#081018",display:"flex",alignItems:"center",justifyContent:"center",color:b?"#22d3ee":"#334155",fontSize:16,fontWeight:700,fontFamily:"monospace"}}>{b}</div>
          ))}
        </div>
        <div style={{textAlign:"center",color:"#94a3b8",fontSize:18,fontFamily:"monospace",marginBottom:4}}>8 + 2 + 1 = <span style={{color:"#34d399",fontWeight:700}}>11</span></div>
        <div style={{borderTop:"1px solid #1e293b",margin:"12px 0"}}/>
        <div style={{color:"#fbbf24",fontSize:11,fontWeight:700,fontFamily:"monospace",marginBottom:12}}>YOUR TURN</div>
        {rows.map((row,i)=>(
          <div key={i} style={{marginBottom:14}}>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:4}}>
              {placeValues.map(v=><div key={v} style={{width:44,textAlign:"center",color:"#7dd3fc",fontSize:13,fontWeight:700,fontFamily:"monospace"}}>{v}</div>)}
              <div style={{width:64}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
              {row.bits.map((b,j)=>(
                <div key={j} style={{width:44,height:36,borderRadius:6,border:`2px solid ${b?"#22d3ee":"#1e293b"}`,background:b?"#0a2a4a":"#081018",display:"flex",alignItems:"center",justifyContent:"center",color:b?"#22d3ee":"#334155",fontSize:16,fontWeight:700,fontFamily:"monospace"}}>{b}</div>
              ))}
              <span style={{color:"#475569",fontSize:16,marginLeft:4}}>=</span>
              <input value={ans[i]} onChange={e=>{const a=[...ans];a[i]=e.target.value.replace(/[^0-9]/g,"");setAns(a);}} placeholder="" maxLength={3}
                style={{width:56,padding:"8px",borderRadius:6,background:"#1e293b",border:`1px solid ${ans[i]&&parseInt(ans[i])===row.answer?"#10b981":"#334155"}`,color:"#e2e8f0",fontSize:16,fontFamily:"monospace",textAlign:"center",minHeight:44}}/>
            </div>
          </div>
        ))}
      </div>
      <ErrMsg msg={msg} attempts={tries}/>
      <HintDisplay puzzleId="filing"/>
      <SubmitRow puzzleId="filing" onSubmit={submit}/>
    </Modal>
  );
}

// ── Puzzle 06 ──────────────────────────────────────────────────────────────
function PuzzleArchive({onClose}) {
  const {dispatch}=useGame();
  const letter=usePuzzleLetter("archive");
  const [bits,setBits]=useState([0,0,0,0,0]);
  const [msg,setMsg]=useState("");
  const [tries,setTries]=useState(0);
  const placeValues=[16,8,4,2,1];
  const target=18;
  const toggle=i=>setBits(b=>{const n=[...b];n[i]=n[i]?0:1;return n;});
  const cur=bits.reduce((s,b,i)=>s+(b*placeValues[i]),0);
  const submit=()=>{
    if(cur===target){dispatch({type:"COMPLETE_PUZZLE",puzzleId:"archive",notification:`✓ Server 06 restored! You earned the letter ${letter}.`});}
    else{dispatch({type:"WRONG_ANSWER"});setTries(t=>t+1);setMsg(`Your current value is ${cur}, not ${target}. Keep adjusting.`);}
  };
  const cellSty=(active)=>({width:48,height:48,borderRadius:6,border:`2px solid ${active?"#22d3ee":"#334155"}`,background:active?"#0a2a4a":"#0f172a",color:active?"#22d3ee":"#475569",fontSize:18,fontWeight:700,cursor:"pointer",fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",minWidth:48,minHeight:48});
  return (
    <Modal title="Server 06 — Restore the Data Archive" onClose={onClose}>
      <div style={{background:"#0f172a",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
        <div style={{color:"#94a3b8",fontSize:13,marginBottom:14,lineHeight:1.6}}>A decimal number is needed to restore the Data Archive. Convert the number to binary to restore power.</div>
        <ReferenceStrip itemId="placeValue"/>
        <div style={{borderTop:"1px solid #1e293b",margin:"12px 0"}}/>
        <div style={{color:"#fbbf24",fontSize:11,fontWeight:700,fontFamily:"monospace",marginBottom:8}}>Example</div>
        <div style={{color:"#fff",fontSize:28,fontWeight:700,fontFamily:"monospace",textAlign:"center",marginBottom:12}}>6</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:6}}>
          {placeValues.map(v=><div key={v} style={{width:48,textAlign:"center",color:"#7dd3fc",fontSize:13,fontWeight:700,fontFamily:"monospace"}}>{v}</div>)}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:8}}>
          {[0,0,1,1,0].map((b,i)=>(
            <div key={i} style={{width:48,height:36,borderRadius:6,border:`2px solid ${b?"#22d3ee":"#1e293b"}`,background:b?"#0a2a4a":"#081018",display:"flex",alignItems:"center",justifyContent:"center",color:b?"#22d3ee":"#334155",fontSize:16,fontWeight:700,fontFamily:"monospace"}}>{b}</div>
          ))}
        </div>
        <div style={{textAlign:"center",color:"#94a3b8",fontSize:13,fontFamily:"monospace",marginBottom:12}}>4 + 2 = <span style={{color:"#34d399",fontWeight:700}}>6</span></div>
        <div style={{borderTop:"1px solid #1e293b",margin:"12px 0"}}/>
        <div style={{color:"#fbbf24",fontSize:11,fontWeight:700,fontFamily:"monospace",marginBottom:12}}>YOUR TURN</div>
        <div style={{color:"#fff",fontSize:28,fontWeight:700,fontFamily:"monospace",textAlign:"center",marginBottom:12}}>{target}</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:8}}>
          {placeValues.map(v=><div key={v} style={{width:48,textAlign:"center",color:"#7dd3fc",fontSize:13,fontWeight:700,fontFamily:"monospace"}}>{v}</div>)}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:10}}>
          {bits.map((b,i)=><button key={i} onClick={()=>toggle(i)} style={cellSty(b===1)}>{b===1?"1":"0"}</button>)}
        </div>
        <div style={{textAlign:"center",fontSize:13,fontFamily:"monospace",color:"#94a3b8",marginTop:4}}>
          {bits.some(b=>b===1)
            ?<span>{bits.map((b,i)=>b?placeValues[i]:null).filter(v=>v!==null).join(" + ")} = <span style={{fontWeight:700,color:cur===target?"#34d399":"#7dd3fc",fontSize:16}}>{cur}</span>{cur===target&&<span style={{color:"#34d399",marginLeft:8}}>✓</span>}</span>
            :<span style={{color:"#334155"}}>Toggle the switches above</span>}
        </div>
      </div>
      <ErrMsg msg={msg} attempts={tries}/>
      <HintDisplay puzzleId="archive"/>
      <SubmitRow puzzleId="archive" onSubmit={submit}/>
    </Modal>
  );
}

// ── Puzzle 07 ──────────────────────────────────────────────────────────────
function PuzzleSafe({onClose}) {
  const {dispatch}=useGame();
  const letter=usePuzzleLetter("safe");
  const [ans,setAns]=useState("");
  const [msg,setMsg]=useState("");
  const [tries,setTries]=useState(0);
  const codes=["00011","01111","00100","00101"];
  const submit=()=>{
    if(ans.trim().toUpperCase()==="CODE"){dispatch({type:"COMPLETE_PUZZLE",puzzleId:"safe",notification:`✓ Server 07 restored! You earned the letter ${letter}.`});}
    else{dispatch({type:"WRONG_ANSWER"});setTries(t=>t+1);setMsg("That code wasn't accepted. Use your Alphabet Decoder File from system files. Try again.");}
  };
  return (
    <Modal title="Server 07 — Crack the Security Lock" onClose={onClose}>
      <p style={{color:"#94a3b8",fontSize:14,marginBottom:16}}>The security lock is encrypted in binary. Decode the sequences to unlock Server 07.</p>
      <ReferenceStrip itemId="alphabet"/>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16,flexWrap:"wrap"}}>
        {codes.map((c,i)=>(
          <div key={i} style={{background:"#0f172a",border:"1px solid #1e40af",borderRadius:8,padding:"12px 10px",textAlign:"center",minWidth:64}}>
            <div style={{fontFamily:"monospace",color:"#7dd3fc",fontSize:14,letterSpacing:2,marginBottom:6}}>{c}</div>
            <div style={{color:"#475569",fontSize:11}}>letter {i+1}</div>
          </div>
        ))}
      </div>
      <div style={{marginBottom:16}}>
        <label style={{color:"#94a3b8",fontSize:13,display:"block",marginBottom:6}}>Enter the decoded word:</label>
        <input value={ans} onChange={e=>setAns(e.target.value)} placeholder="_ _ _ _" maxLength={4}
          style={{width:"100%",padding:"12px 14px",borderRadius:6,background:"#1e293b",border:"1px solid #334155",color:"#e2e8f0",fontSize:22,fontFamily:"monospace",letterSpacing:8,textAlign:"center",boxSizing:"border-box",minHeight:48}}/>
      </div>
      <ErrMsg msg={msg} attempts={tries}/>
      <HintDisplay puzzleId="safe"/>
      <SubmitRow puzzleId="safe" onSubmit={submit}/>
    </Modal>
  );
}

// ── Touch-friendly drag item component ────────────────────────────────────
function DraggableItem({item, onDrop, shaking}) {
  const touchedRef = useRef(false);

  function onTouchStart(e) {
    e.preventDefault();
    touchedRef.current = true;
    onDrop(item.id);
    // reset after a short delay so repeated taps still work
    setTimeout(() => { touchedRef.current = false; }, 500);
  }

  function onClick(e) {
    // suppress the synthetic click that fires after touchstart
    if(touchedRef.current) { e.preventDefault(); return; }
    onDrop(item.id);
  }

  return (
    <button
      onTouchStart={onTouchStart}
      onClick={onClick}
      className={shaking===item.id?"shake":""}
      style={{padding:"10px 12px",borderRadius:6,background:shaking===item.id?"#3b0f0f":"#1e3a5f",border:`1px solid ${shaking===item.id?"#ef4444":"#3b82f6"}`,color:shaking===item.id?"#ef4444":"#e2e8f0",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:6,transition:"background 0.2s,border-color 0.2s,color 0.2s",minHeight:44,userSelect:"none",WebkitUserSelect:"none",touchAction:"none"}}>
      <span>{item.icon}</span>{item.label}
    </button>
  );
}

// ── Puzzle 08 ──────────────────────────────────────────────────────────────
function PuzzleDoor({onClose}) {
  const {dispatch}=useGame();
  const letter=usePuzzleLetter("door");
  const [dropped,setDropped]=useState([]);
  const [terminalLog,setTerminalLog]=useState([]);
  const [msg,setMsg]=useState("");
  const [tries,setTries]=useState(0);
  const [shaking,setShaking]=useState(null);
  const terminalRef=useRef(null);

  const [allItems]=useState(()=>shuffleArray([
    {id:"text",   label:"Text",       icon:"📄",digital:true},
    {id:"picture",label:"Picture",    icon:"🖼️",digital:true},
    {id:"music",  label:"Music",      icon:"🎵",digital:true},
    {id:"video",  label:"Video",      icon:"🎥",digital:true},
    {id:"game",   label:"Video Game", icon:"🎮",digital:true},
    {id:"email",  label:"Email",      icon:"📧",digital:true},
    {id:"book",   label:"Book",       icon:"📚",digital:false},
    {id:"pencil", label:"Pencil",     icon:"🖍️",digital:false},
    {id:"apple",  label:"Apple",      icon:"🍎",digital:false},
    {id:"bball",  label:"Basketball", icon:"🏀",digital:false},
    {id:"key",    label:"Key",        icon:"🔑",digital:false},
  ]));

  const digitalItems=allItems.filter(i=>i.digital);
  const remaining=allItems.filter(f=>!dropped.includes(f.id));
  const correctDropped=dropped.filter(id=>allItems.find(i=>i.id===id)?.digital);
  const allDigitalLoaded=digitalItems.every(d=>dropped.includes(d.id));
  const binaryMap={text:"01010100 01000101 01011000 01010100",picture:"01110000 01101001 01111000 01100101",music:"10110100 00110010 10000001 00110100",video:"11001010 00110001 10111010 01000011",game:"01100111 01100001 01101101 01100101",email:"01100101 01101101 01100001 01101001"};

  const triggerShake=id=>{setShaking(id);setTimeout(()=>setShaking(null),600);};

  const drop=id=>{
    const item=allItems.find(i=>i.id===id);if(!item)return;
    if(!item.digital){triggerShake(id);setTerminalLog(l=>[...l,{id:Date.now(),text:`[${item.icon} ${item.label.toUpperCase()}] → ✗ This object is not digital.`,error:true}]);return;}
    setTerminalLog(l=>[...l,{id:Date.now(),text:`[${item.icon} ${item.label.toUpperCase()}] → ${binaryMap[id]||""}`,error:false}]);
    setDropped(d=>[...d,id]);
  };

  const handleItemInteraction = id => drop(id);

  const submit=()=>{
    if(allDigitalLoaded){dispatch({type:"COMPLETE_PUZZLE",puzzleId:"door",notification:`✓ Server 08 restored! You earned the letter ${letter}.`});}
    else{dispatch({type:"WRONG_ANSWER"});setTries(t=>t+1);setMsg(`Load all 6 digital items into the terminal. ${correctDropped.length}/6 loaded.`);}
  };

  return (
    <Modal title="Server 08 — Restore the Network" onClose={onClose}>
      <div style={{background:"#0f172a",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
        <div style={{color:"#94a3b8",fontSize:13,marginBottom:4,lineHeight:1.6}}>All digital information can be represented as binary.</div>
        <div style={{color:"#94a3b8",fontSize:13,marginBottom:14,lineHeight:1.6}}>Tap the digital items to load them into the terminal.</div>
        <div style={{marginBottom:12}}>
          <div style={{color:"#475569",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:8,fontFamily:"monospace"}}>ITEMS — tap to load</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",minHeight:44}}>
            {remaining.map(f=>(
              <DraggableItem key={f.id} item={f} onDrop={handleItemInteraction} shaking={shaking}/>
            ))}
            {remaining.length===0&&<div style={{color:"#10b981",fontSize:13,padding:"4px 0"}}>All items loaded</div>}
          </div>
        </div>
        <div ref={terminalRef}
          style={{background:"#040c18",border:"1px solid #1e40af",borderRadius:8,padding:10,minHeight:100}}>
          <div style={{color:"#475569",fontSize:10,letterSpacing:1,marginBottom:6,fontFamily:"monospace"}}>TERMINAL — {correctDropped.length}/6 DIGITAL FILES LOADED</div>
          {terminalLog.length===0&&<div style={{color:"#1e3a5f",fontSize:12,fontFamily:"monospace",fontStyle:"italic"}}>Awaiting input...</div>}
          {terminalLog.map(e=>(
            <div key={e.id} style={{fontFamily:"monospace",fontSize:11,marginBottom:3,color:e.error?"#f87171":"#22d3ee"}}>{e.text}</div>
          ))}
          {allDigitalLoaded&&(
            <div style={{marginTop:8,padding:"6px 10px",background:"#064e3b",borderRadius:6,border:"1px solid #10b981",textAlign:"center"}}>
              <div style={{color:"#6ee7b7",fontSize:11,marginBottom:2,fontFamily:"monospace"}}>ALL DIGITAL FILES LOADED</div>
              <div style={{fontFamily:"monospace",color:"#34d399",fontSize:13,fontWeight:700}}>NETWORK RESTORED ✓</div>
            </div>
          )}
        </div>
      </div>
      <ErrMsg msg={msg} attempts={tries}/>
      <HintDisplay puzzleId="door"/>
      <SubmitRow puzzleId="door" onSubmit={submit}/>
    </Modal>
  );
}

// ── Exit Password ──────────────────────────────────────────────────────────
function ExitPasswordModal({onClose}) {
  const {state,dispatch}=useGame();
  const [msg,setMsg]=useState("");
  const [tries,setTries]=useState(0);
  const [tiles,setTiles]=useState(()=>[...state.collectedLetters].map((l,i)=>({id:i,letter:l,placed:false})));
  const [slots,setSlots]=useState(Array(6).fill(null));

  const available=tiles.filter(t=>!t.placed);
  const answer=slots.map(id=>id!==null?tiles.find(t=>t.id===id)?.letter:"").join("");
  const isComplete=slots.every(s=>s!==null);

  const clickTile=tileId=>{
    const e=slots.findIndex(s=>s===null);if(e===-1)return;
    setSlots(s=>{const n=[...s];n[e]=tileId;return n;});
    setTiles(t=>t.map(x=>x.id===tileId?{...x,placed:true}:x));
  };
  const clickSlot=si=>{
    const tileId=slots[si];if(tileId===null)return;
    setSlots(s=>{const n=[...s];n[si]=null;return n;});
    setTiles(t=>t.map(x=>x.id===tileId?{...x,placed:false}:x));
  };

  const submit=()=>{
    if(!isComplete){setMsg("Place all 6 letters first.");return;}
    if(answer==="BINARY"){dispatch({type:"SUBMIT_PASSWORD",password:"BINARY"});}
    else{dispatch({type:"WRONG_ANSWER"});setTries(t=>t+1);setMsg("That's not the right word. Keep rearranging.");}
  };

  return (
    <Modal title="Exit Door — Master Password" onClose={onClose}>
      <div style={{background:"#0f172a",borderRadius:8,padding:14,marginBottom:14}}>
        <p style={{color:"#94a3b8",fontSize:13,margin:"0 0 16px",lineHeight:1.6}}>Tap letters to place them. Tap a placed letter to return it.</p>

        {/* Answer slots */}
        <div style={{marginBottom:16}}>
          <div style={{color:"#475569",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:8,fontFamily:"monospace"}}>YOUR ANSWER</div>
          <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
            {slots.map((tileId,i)=>{
              const tile=tileId!==null?tiles.find(t=>t.id===tileId):null;
              return (
                <button key={i} onClick={()=>clickSlot(i)}
                  style={{width:48,height:48,borderRadius:6,border:`2px solid ${tile?"#22d3ee":"#1e293b"}`,background:tile?"#0a2a4a":"#050c18",color:"#22d3ee",fontSize:20,fontWeight:700,fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"center",cursor:tile?"pointer":"default",minWidth:48,minHeight:48}}>
                  {tile?tile.letter:""}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tile tray */}
        <div style={{minHeight:60,padding:"10px 8px",background:"#060e1a",borderRadius:8,border:"1px solid #1e293b",display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:8}}>
          {available.length===0
            ?<div style={{color:"#1e3a5f",fontSize:12,fontFamily:"monospace",alignSelf:"center"}}>All letters placed</div>
            :available.map(tile=>(
              <button key={tile.id} onClick={()=>clickTile(tile.id)}
                style={{width:48,height:48,borderRadius:6,border:"2px solid #22d3ee",background:"#0a2a4a",color:"#22d3ee",fontSize:20,fontWeight:700,fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",minWidth:48,minHeight:48}}>
                {tile.letter}
              </button>
            ))
          }
        </div>
        <div style={{color:"#334155",fontSize:11,textAlign:"center",fontFamily:"monospace"}}>Tap a letter to place it · Tap a slot to return it</div>
      </div>
      <ErrMsg msg={msg} attempts={tries}/>
      <HintDisplay puzzleId="__exit__"/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <HintButton puzzleId="__exit__"/>
        <button onClick={submit} style={{padding:"10px 18px",borderRadius:6,background:"#1d4ed8",border:"none",color:"#fff",cursor:"pointer",fontSize:14,fontWeight:600,minHeight:44}}>Submit</button>
      </div>
    </Modal>
  );
}

// ── Active Puzzle Router ───────────────────────────────────────────────────
function ActivePuzzle() {
  const {state,dispatch}=useGame();
  const close=()=>dispatch({type:"CLOSE_PUZZLE"});
  if(!state.activePuzzle) return null;
  if(state.activePuzzle.startsWith("__inv__")) return <InventoryModal item={state.activePuzzle.replace("__inv__","")} onClose={close}/>;
  if(state.activePuzzle==="__exit__") return <ExitPasswordModal onClose={close}/>;
  const rs=state.roomObjects[state.activePuzzle];
  if(rs===STATES.COMPLETED||rs===STATES.RESTORED){
    return (
      <Modal title="Puzzle Complete" onClose={close}>
        <div style={{textAlign:"center",padding:16}}>
          <div style={{fontSize:40,marginBottom:12}}>✅</div>
          <p style={{color:"#34d399",fontWeight:600,marginBottom:8}}>Already solved!</p>
          <button onClick={close} style={{marginTop:12,padding:"10px 20px",borderRadius:6,background:"#1d4ed8",border:"none",color:"#fff",cursor:"pointer",minHeight:44}}>Close</button>
        </div>
      </Modal>
    );
  }
  const map={computer:<PuzzleComputer onClose={close}/>,server:<PuzzleServer onClose={close}/>,filing:<PuzzleFiling onClose={close}/>,archive:<PuzzleArchive onClose={close}/>,safe:<PuzzleSafe onClose={close}/>,door:<PuzzleDoor onClose={close}/>};
  return map[state.activePuzzle]||null;
}

// ── Terminal ───────────────────────────────────────────────────────────────
function Terminal() {
  const {state}=useGame();
  const [invItem,setInvItem]=useState(null);
  return (
    <>
    {invItem&&<InventoryModal item={invItem} onClose={()=>setInvItem(null)}/>}
    <div style={{position:"fixed",left:0,top:44,bottom:0,width:"min(272px,35vw)",background:"#070d1a",borderRight:"1px solid #1e293b",zIndex:100,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        <section style={{padding:"12px",borderBottom:"1px solid #1e293b"}}>
          <div style={{color:"#475569",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:8}}>SYSTEM FILES</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {Object.values(INVENTORY_DATA).map(item=>(
              <button key={item.id} onClick={()=>setInvItem(item.id)} style={{display:"flex",gap:8,alignItems:"center",padding:"10px",borderRadius:6,background:"#0f172a",border:"1px solid #1e40af",cursor:"pointer",textAlign:"left",width:"100%",minHeight:48}}>
                <span style={{fontSize:18}}>{item.icon}</span>
                <span style={{color:"#7dd3fc",fontSize:11,fontWeight:600}}>{item.title}</span>
              </button>
            ))}
          </div>
        </section>
        <section style={{padding:"12px"}}>
          <div style={{color:"#475569",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:8}}>MASTER PASSWORD</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Array.from({length:6},(_,i)=>{
              const letter=state.collectedLetters[i];
              const earned=!!letter;
              return (
                <div key={i} style={{width:34,height:40,borderRadius:5,background:earned?"#0a1e36":"#050c18",border:`1px solid ${earned?"#22d3ee":"#1e293b"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:16,fontWeight:700,color:earned?"#22d3ee":"#1e3a5f",fontFamily:"monospace"}}>{earned?letter:"_"}</span>
                </div>
              );
            })}
          </div>
          <div style={{color:"#475569",fontSize:11,marginTop:8,lineHeight:1.5}}>Restore all servers to collect every letter.</div>
          {state.exitUnlocked&&<div style={{marginTop:8,padding:"8px 10px",background:"#064e3b",border:"1px solid #10b981",borderRadius:6,color:"#34d399",fontSize:12,fontWeight:600}}>🔓 Exit unlocked — tap the EXIT door!</div>}
        </section>
      </div>
    </div>
    </>
  );
}

// ── Room Scene ─────────────────────────────────────────────────────────────
function RoomScene({completedCount,roomObjects,onClickObject}) {
  const [hovered,setHovered]=useState(null);
  const allRestored=completedCount>=6;
  const stateOf=id=>roomObjects[id];
  const glowOf=id=>{const s=stateOf(id);if(s===STATES.RESTORED||s===STATES.COMPLETED)return"#10b981";if(s===STATES.AVAILABLE)return"#22d3ee";return"#ef4444";};
  const solved=id=>stateOf(id)===STATES.COMPLETED||stateOf(id)===STATES.RESTORED;
  return (
    <svg width="100%" height="100%" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg" style={{display:"block",touchAction:"none"}}>
      <defs>
        <radialGradient id="exitGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={allRestored?"#22d3ee":"#1e3a5f"} stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#040814" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#070f1e"/><stop offset="100%" stopColor="#020509"/>
        </linearGradient>
        <filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
        <clipPath id="clip"><rect width="900" height="600"/></clipPath>
      </defs>
      <g clipPath="url(#clip)">
        <rect width="900" height="600" fill="#040814"/>
        <rect width="900" height="160" fill="#050c1a"/>
        {[80,200,340,560,700,820].map((x,i)=><rect key={i} x={x} y={0} width={8} height={160} fill="#060e1e" stroke="#0a1628" strokeWidth="1"/>)}
        <rect x={0} y={152} width={900} height={4} fill="#0a1628"/>
        <polygon points="0,600 900,600 900,370 0,370" fill="url(#floorGrad)"/>
        {[0,1,2,3,4,5].map(row=>[0,1,2,3,4,5,6,7].map(col=><rect key={`${row}-${col}`} x={col*112+((row%2)*56)} y={370+row*40} width={110} height={38} fill="none" stroke="#0a1830" strokeWidth="0.5" opacity="0.5"/>))}
        <ellipse cx={450} cy={265} rx={120} ry={80} fill="url(#exitGlow)" filter="url(#blur6)"/>

        {/* SERVER 01 */}
        {(()=>{const ok=solved("computer");const c=ok?"#10b981":"#ef4444";const bg=ok?"#051a0d":"#1a0505";return(<><rect x={0} y={60} width={95} height={320} fill="#060e1a" stroke="#0a1830" strokeWidth="1"/><rect x={2} y={62} width={91} height={26} fill={bg} stroke={c} strokeWidth="0.5"/><text x={47} y={74} textAnchor="middle" fontSize="8" fill={c} fontFamily="monospace" fontWeight="700">SERVER 01</text><text x={47} y={85} textAnchor="middle" fontSize="7.5" fill={c} fontFamily="monospace">{ok?"ONLINE":"OFFLINE"}</text>{[0,1,2,3,4,5,6,7,8,9,10,11,12].map(r=><g key={r}><rect x={5} y={94+r*17} width={85} height={13} fill="#040c18" stroke="#0d1e30" strokeWidth="0.5" rx="1"/>{[0,1,2,3,4,5,6].map(d=><circle key={d} cx={10+d*12} cy={100+r*17} r={2} fill={ok?"#10b981":"#7f1d1d"} opacity={0.7}/>)}</g>)}</>)})()}
        {/* SERVER 02 */}
        {(()=>{const ok=solved("server");const c=ok?"#10b981":"#ef4444";const bg=ok?"#051a0d":"#1a0505";return(<><rect x={95} y={80} width={110} height={300} fill="#07101e" stroke="#0a1830" strokeWidth="1"/><rect x={97} y={82} width={106} height={26} fill={bg} stroke={c} strokeWidth="0.5"/><text x={150} y={94} textAnchor="middle" fontSize="8" fill={c} fontFamily="monospace" fontWeight="700">SERVER 02</text><text x={150} y={105} textAnchor="middle" fontSize="7.5" fill={c} fontFamily="monospace">{ok?"ONLINE":"OFFLINE"}</text>{[0,1,2,3,4,5,6,7,8,9,10].map(r=><g key={r}><rect x={100} y={114+r*19} width={102} height={15} fill="#040c18" stroke="#0d1e30" strokeWidth="0.5" rx="1"/>{[0,1,2,3,4,5,6,7].map(d=><circle key={d} cx={106+d*12} cy={121+r*19} r={2} fill={ok?"#10b981":"#7f1d1d"} opacity={0.6}/>)}</g>)}</>)})()}
        {/* SERVER 03 */}
        {(()=>{const ok=solved("filing");const c=ok?"#10b981":"#ef4444";const bg=ok?"#051a0d":"#1a0505";return(<><rect x={205} y={100} width={90} height={260} fill="#08111f" stroke="#0c1e32" strokeWidth="1"/><rect x={207} y={102} width={86} height={26} fill={bg} stroke={c} strokeWidth="0.5"/><text x={250} y={114} textAnchor="middle" fontSize="8" fill={c} fontFamily="monospace" fontWeight="700">SERVER 03</text><text x={250} y={125} textAnchor="middle" fontSize="7.5" fill={c} fontFamily="monospace">{ok?"ONLINE":"OFFLINE"}</text>{[0,1,2,3,4,5,6,7,8].map(r=><g key={r}><rect x={210} y={134+r*15} width={82} height={12} fill="#040c18" stroke="#0d1e30" strokeWidth="0.5" rx="1"/>{[0,1,2,3,4].map(d=><circle key={d} cx={216+d*15} cy={140+r*15} r={2} fill={ok?"#10b981":"#7f1d1d"} opacity={0.5}/>)}</g>)}</>)})()}
        {/* SERVER 06 */}
        {(()=>{const ok=solved("archive");const c=ok?"#10b981":"#ef4444";const bg=ok?"#051a0d":"#1a0505";return(<><rect x={605} y={100} width={90} height={260} fill="#08111f" stroke="#0c1e32" strokeWidth="1"/><rect x={607} y={102} width={86} height={26} fill={bg} stroke={c} strokeWidth="0.5"/><text x={650} y={114} textAnchor="middle" fontSize="8" fill={c} fontFamily="monospace" fontWeight="700">SERVER 06</text><text x={650} y={125} textAnchor="middle" fontSize="7.5" fill={c} fontFamily="monospace">{ok?"ONLINE":"OFFLINE"}</text>{[0,1,2,3,4,5,6,7,8].map(r=><g key={r}><rect x={610} y={134+r*15} width={82} height={12} fill="#040c18" stroke="#0d1e30" strokeWidth="0.5" rx="1"/>{[0,1,2,3,4].map(d=><circle key={d} cx={616+d*15} cy={140+r*15} r={2} fill={ok?"#10b981":"#7f1d1d"} opacity={0.5}/>)}</g>)}</>)})()}
        {/* SERVER 07 */}
        {(()=>{const ok=solved("safe");const c=ok?"#10b981":"#ef4444";const bg=ok?"#051a0d":"#1a0505";return(<><rect x={695} y={80} width={110} height={300} fill="#07101e" stroke="#0a1830" strokeWidth="1"/><rect x={697} y={82} width={106} height={26} fill={bg} stroke={c} strokeWidth="0.5"/><text x={750} y={94} textAnchor="middle" fontSize="8" fill={c} fontFamily="monospace" fontWeight="700">SERVER 07</text><text x={750} y={105} textAnchor="middle" fontSize="7.5" fill={c} fontFamily="monospace">{ok?"ONLINE":"OFFLINE"}</text>{[0,1,2,3,4,5,6,7,8,9,10].map(r=><g key={r}><rect x={700} y={114+r*19} width={102} height={15} fill="#040c18" stroke="#0d1e30" strokeWidth="0.5" rx="1"/>{[0,1,2,3,4,5,6,7].map(d=><circle key={d} cx={706+d*12} cy={121+r*19} r={2} fill={ok?"#10b981":"#7f1d1d"} opacity={0.6}/>)}</g>)}</>)})()}
        {/* SERVER 08 */}
        {(()=>{const ok=solved("door");const c=ok?"#10b981":"#ef4444";const bg=ok?"#051a0d":"#1a0505";return(<><rect x={805} y={60} width={95} height={320} fill="#060e1a" stroke="#0a1830" strokeWidth="1"/><rect x={807} y={62} width={91} height={26} fill={bg} stroke={c} strokeWidth="0.5"/><text x={852} y={74} textAnchor="middle" fontSize="8" fill={c} fontFamily="monospace" fontWeight="700">SERVER 08</text><text x={852} y={85} textAnchor="middle" fontSize="7.5" fill={c} fontFamily="monospace">{ok?"ONLINE":"OFFLINE"}</text>{[0,1,2,3,4,5,6,7,8,9,10,11,12].map(r=><g key={r}><rect x={808} y={94+r*17} width={85} height={13} fill="#040c18" stroke="#0d1e30" strokeWidth="0.5" rx="1"/>{[0,1,2,3,4,5,6].map(d=><circle key={d} cx={813+d*12} cy={100+r*17} r={2} fill={ok?"#10b981":"#7f1d1d"} opacity={0.7}/>)}</g>)}</>)})()}

        {/* Mid corridor */}
        <rect x={295} y={130} width={60} height={200} fill="#09121e" stroke="#0c1e32" strokeWidth="0.5"/>
        {[0,1,2,3,4,5,6,7,8,9].map(r=><g key={r}><rect x={298} y={135+r*18} width={54} height={14} fill="#040c18" stroke="#0d1830" strokeWidth="0.3" rx="1"/>{[0,1,2].map(d=><circle key={d} cx={304+d*16} cy={142+r*18} r={1.5} fill="#22d3ee" opacity={0.3}/>)}</g>)}
        <rect x={545} y={130} width={60} height={200} fill="#09121e" stroke="#0c1e32" strokeWidth="0.5"/>
        {[0,1,2,3,4,5,6,7,8,9].map(r=><g key={r}><rect x={548} y={135+r*18} width={54} height={14} fill="#040c18" stroke="#0d1830" strokeWidth="0.3" rx="1"/>{[0,1,2].map(d=><circle key={d} cx={554+d*16} cy={142+r*18} r={1.5} fill="#22d3ee" opacity={0.3}/>)}</g>)}

        {/* EXIT DOOR */}
        <rect x={355} y={155} width={190} height={220} fill="#050c1a" stroke="#081828" strokeWidth="1"/>
        <rect x={408} y={160} width={84} height={20} fill={allRestored?"#064e3b":"#1a0505"} stroke={allRestored?"#10b981":"#7f1d1d"} strokeWidth="1" rx="2"/>
        <text x={450} y={174} textAnchor="middle" fontSize="11" fill={allRestored?"#34d399":"#ef4444"} fontFamily="monospace" fontWeight="700">EXIT</text>
        <rect x={395} y={182} width={110} height={180} fill="#040a14" stroke={allRestored?"#22d3ee":"#1e3a5f"} strokeWidth="2"/>
        {allRestored&&<rect x={396} y={183} width={108} height={178} fill="#22d3ee" opacity="0.06"/>}
        <rect x={430} y={allRestored?262:258} width={40} height={32} fill={allRestored?"#064e3b":"#1a0505"} stroke={allRestored?"#10b981":"#1e3a5f"} strokeWidth="1.5" rx="3"/>
        {allRestored?<path d="M438,262 Q432,245 444,241 Q456,237 462,250" fill="none" stroke="#10b981" strokeWidth="2.5"/>:<path d="M438,258 Q438,246 450,246 Q462,246 462,258" fill="none" stroke="#1e3a5f" strokeWidth="2.5"/>}
        <circle cx={450} cy={allRestored?277:273} r={5} fill={allRestored?"#34d399":"#2d4a6a"}/>
        {allRestored&&<line x1={450} y1={282} x2={450} y2={287} stroke="#34d399" strokeWidth="2"/>}
        {allRestored&&hovered==="door_exit"&&<rect x={393} y={158} width={114} height={210} fill="#22d3ee" opacity="0.08" stroke="#22d3ee" strokeWidth="2"/>}
        {allRestored&&<text x={450} y={382} textAnchor="middle" fontSize="9" fill="#22d3ee" fontFamily="monospace" fontWeight="700" opacity={hovered==="door_exit"?1:0.6}>▶ ENTER PASSWORD</text>}

        {/* Desk */}
        <polygon points="80,600 820,600 780,390 120,390" fill="#050d1a" stroke="#0a1628" strokeWidth="1"/>

        {/* Server hotspots — large touch targets */}
        {[{id:"computer",x:0,y:58,w:97,h:322},{id:"server",x:93,y:78,w:114,h:302},{id:"filing",x:205,y:98,w:92,h:262},{id:"archive",x:603,y:98,w:92,h:262},{id:"safe",x:693,y:78,w:114,h:302},{id:"door",x:803,y:58,w:97,h:322}].map(({id,x,y,w,h})=>(
          <g key={id}
            onClick={()=>onClickObject(id)}
            onMouseEnter={()=>setHovered(id)}
            onMouseLeave={()=>setHovered(null)}
            style={{cursor:"pointer"}}>
            <rect x={x} y={y} width={w} height={h} fill="transparent"/>
            {hovered===id&&<rect x={x} y={y} width={w} height={h} fill={glowOf(id)} opacity="0.07" stroke={glowOf(id)} strokeWidth="1.5"/>}
          </g>
        ))}
        <rect x={393} y={158} width={114} height={210} fill="transparent"
          onMouseEnter={()=>setHovered("door_exit")} onMouseLeave={()=>setHovered(null)}/>
      </g>
    </svg>
  );
}

// ── Completion Screen ──────────────────────────────────────────────────────
function CompletionScreen() {
  const {state,dispatch}=useGame();
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(2,5,15,0.97)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}>
      <div style={{textAlign:"center",maxWidth:460,width:"100%",padding:"28px 24px",background:"#0a1628",border:"1px solid #10b981",borderRadius:16,boxShadow:"0 0 60px rgba(16,185,129,0.25)"}}>
        <div style={{fontSize:48,marginBottom:12}}>🎉</div>
        <h1 style={{color:"#34d399",fontSize:24,fontWeight:700,margin:"0 0 6px",letterSpacing:1}}>YOU ESCAPED!</h1>
        <p style={{color:"#64748b",fontSize:14,margin:"0 0 24px",lineHeight:1.6}}>All servers restored. The lab is back online.<br/>You've mastered the language of computers.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:24}}>
          {[{label:"Final Score",value:`${state.score}`,sub:"out of 100",color:"#34d399"},{label:"Hints Used",value:`${state.hintsUsed}`,sub:`-${state.hintsUsed*5} pts`,color:"#fbbf24"},{label:"Attempts",value:`${state.attempts}`,sub:`-${state.attempts*2} pts`,color:"#f472b6"}].map(({label,value,sub,color})=>(
            <div key={label} style={{background:"#060f1e",borderRadius:10,padding:"12px 8px",border:"1px solid #1e293b"}}>
              <div style={{color:"#475569",fontSize:10,marginBottom:4,letterSpacing:1}}>{label.toUpperCase()}</div>
              <div style={{color,fontSize:24,fontWeight:700,fontFamily:"monospace"}}>{value}</div>
              <div style={{color:"#334155",fontSize:10,marginTop:3}}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{background:"#042f1f",border:"1px solid #064e3b",borderRadius:8,padding:"12px",marginBottom:20,textAlign:"left"}}>
          <div style={{color:"#6ee7b7",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:8}}>WHAT YOU LEARNED</div>
          {["Computers use only 0 and 1","0 = OFF,  1 = ON","Binary represents numbers","Binary represents letters","All digital information is binary"].map(s=>(
            <div key={s} style={{color:"#a7f3d0",fontSize:12,padding:"3px 0",display:"flex",gap:8}}><span style={{color:"#34d399"}}>✓</span>{s}</div>
          ))}
        </div>
        <button onClick={()=>dispatch({type:"RESET"})} style={{padding:"12px 36px",borderRadius:8,background:"#1d4ed8",border:"none",color:"#fff",cursor:"pointer",fontSize:15,fontWeight:700,letterSpacing:1,minHeight:48}}>PLAY AGAIN</button>
      </div>
    </div>
  );
}

// ── Intro Screen ───────────────────────────────────────────────────────────
function IntroScreen({onStart}) {
  return (
    <div style={{position:"fixed",inset:0,background:"#020810",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",fontFamily:"system-ui,sans-serif",padding:16}}>
      <div style={{position:"absolute",inset:0}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:"38%",background:"linear-gradient(180deg,#030912 0%,#050d1a 100%)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"32%",background:"linear-gradient(0deg,#020608 0%,#040c18 100%)"}}/>
        <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:60,height:8,background:"#7dd3fc",boxShadow:"0 0 40px 20px rgba(125,211,252,0.35)",borderRadius:"0 0 4px 4px"}}/>
        {[0,1,2,3,4].map(i=>(
          <div key={i} style={{position:"absolute",left:`${i*5}%`,top:"8%",bottom:"30%",width:"4%",background:"#060e1a",border:"1px solid #0a1628",overflow:"hidden",display:"flex",flexDirection:"column",gap:3,padding:"6px 3px"}}>
            {Array.from({length:18},(_,r)=><div key={r} style={{height:6,background:"#0a1628",borderRadius:1,display:"flex",gap:2,alignItems:"center",padding:"0 2px"}}>{[0,1,2,3].map(d=><div key={d} style={{width:3,height:3,borderRadius:"50%",background:Math.random()>0.5?"#ef4444":"#3b82f6",opacity:0.7}}/>)}</div>)}
          </div>
        ))}
        {[0,1,2,3,4].map(i=>(
          <div key={i} style={{position:"absolute",right:`${i*5}%`,top:"8%",bottom:"30%",width:"4%",background:"#060e1a",border:"1px solid #0a1628",overflow:"hidden",display:"flex",flexDirection:"column",gap:3,padding:"6px 3px"}}>
            {Array.from({length:18},(_,r)=><div key={r} style={{height:6,background:"#0a1628",borderRadius:1,display:"flex",gap:2,alignItems:"center",padding:"0 2px"}}>{[0,1,2,3].map(d=><div key={d} style={{width:3,height:3,borderRadius:"50%",background:Math.random()>0.5?"#1d4ed8":"#22d3ee",opacity:0.6}}/>)}</div>)}
          </div>
        ))}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"32%",backgroundImage:"linear-gradient(rgba(34,211,238,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.08) 1px,transparent 1px)",backgroundSize:"40px 40px"}}/>
        <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:"60%",height:120,background:"radial-gradient(ellipse,rgba(34,211,238,0.15) 0%,transparent 70%)"}}/>
      </div>

      {/* Corner widgets */}
      <div style={{position:"absolute",top:16,left:16,border:"1px solid #ef4444",borderRadius:4,padding:"6px 10px",background:"rgba(127,29,29,0.2)",display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:14,height:14,borderRadius:"50%",border:"2px solid #ef4444",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:5,height:5,borderRadius:"50%",background:"#ef4444"}}/></div>
        <div style={{display:"flex",flexDirection:"column",gap:3}}>{[36,24,24].map((w,i)=><div key={i} style={{height:2,width:w,background:"#ef4444",borderRadius:1}}/>)}</div>
      </div>
      <div style={{position:"absolute",top:16,right:16,border:"1px solid #22d3ee",borderRadius:4,padding:"6px 10px",background:"rgba(34,211,238,0.08)",display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:14,height:14,borderRadius:"50%",border:"2px solid #22d3ee"}}/>
        <div style={{display:"flex",flexDirection:"column",gap:3}}>{[32,24,24].map((w,i)=><div key={i} style={{height:2,width:w,background:"#22d3ee",borderRadius:1,opacity:0.7}}/>)}</div>
      </div>
      <div style={{position:"absolute",bottom:16,left:16,border:"1px solid #22d3ee",borderRadius:4,padding:"6px 10px",background:"rgba(34,211,238,0.06)",display:"flex",alignItems:"center",gap:8}}>
        <div style={{display:"flex",gap:2}}>{Array.from({length:9},(_,i)=><div key={i} style={{width:4,height:10,background:i<7?"#22d3ee":"#0a1628",borderRadius:1}}/>)}</div>
      </div>
      <div style={{position:"absolute",bottom:16,right:16,border:"1px solid #22d3ee",borderRadius:4,padding:"6px 10px",background:"rgba(34,211,238,0.06)",display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:14,height:14,borderRadius:"50%",border:"2px solid #22d3ee"}}/>
        <div style={{display:"flex",flexDirection:"column",gap:3}}>{[28,20].map((w,i)=><div key={i} style={{height:2,width:w,background:"#22d3ee",borderRadius:1,opacity:0.7}}/>)}</div>
      </div>

      {/* Main HUD frame */}
      <div style={{position:"relative",width:"min(600px,92%)",boxShadow:"0 0 30px rgba(34,211,238,0.35)"}}>
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} viewBox="0 0 600 400" preserveAspectRatio="none">
          <path d="M22,0 L578,0 L600,22 L600,378 L578,400 L22,400 L0,378 L0,22 Z" fill="rgba(2,8,16,0.88)" stroke="#22d3ee" strokeWidth="1.5"/>
          <path d="M30,6 L570,6 L594,30 L594,370 L570,394 L30,394 L6,370 L6,30 Z" fill="none" stroke="#22d3ee" strokeWidth="0.4" opacity="0.3"/>
          {[[0,0,1,1],[600,0,-1,1],[600,400,-1,-1],[0,400,1,-1]].map(([cx,cy,sx,sy],i)=>(
            <g key={i} stroke="#22d3ee" strokeWidth="1.5" fill="none">
              <line x1={cx} y1={cy+sy*6} x2={cx} y2={cy+sy*24}/>
              <line x1={cx+sx*6} y1={cy} x2={cx+sx*24} y2={cy}/>
            </g>
          ))}
        </svg>
        <div style={{padding:"36px 44px 32px",position:"relative"}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:"clamp(20px,4vw,28px)",fontWeight:900,letterSpacing:6,fontFamily:"monospace",color:"#ef4444",textShadow:"0 0 12px #ef4444,0 0 28px rgba(239,68,68,0.5)"}}>
              SYSTEM ALERT
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:28}}>
            {[{text:"Critical server failure detected.",color:"#ef4444"},{text:"Emergency lockdown activated.",color:"#ef4444"}].map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:13,height:13,borderRadius:"50%",border:`2px solid ${item.color}`,background:`${item.color}33`,flexShrink:0,boxShadow:`0 0 8px ${item.color}`}}/>
                <span style={{color:"#94a3b8",fontSize:"clamp(13px,2vw,15px)",fontFamily:"monospace"}}>{item.text}</span>
              </div>
            ))}
            <div style={{borderTop:"1px solid rgba(34,211,238,0.2)",margin:"4px 0"}}/>
            <div style={{color:"#22d3ee",fontSize:12,fontWeight:700,letterSpacing:2,fontFamily:"monospace",marginBottom:2}}>MISSION OBJECTIVES</div>
            {["Restore all servers.","Recover the Master Password letters.","Reconstruct the Master Password.","Unlock the exit."].map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:13,height:13,borderRadius:"50%",border:"2px solid #22d3ee",background:"rgba(34,211,238,0.15)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 8px rgba(34,211,238,0.5)"}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:"#22d3ee"}}/>
                </div>
                <span style={{color:"#cbd5e1",fontSize:"clamp(13px,2vw,15px)",fontFamily:"monospace"}}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center"}}>
            <button onClick={onStart}
              style={{position:"relative",padding:"14px 44px",background:"rgba(34,211,238,0.1)",border:"1.5px solid #22d3ee",borderRadius:4,cursor:"pointer",fontFamily:"monospace",fontSize:"clamp(13px,2vw,15px)",fontWeight:700,letterSpacing:3,color:"#22d3ee",textShadow:"0 0 12px rgba(34,211,238,0.8)",minHeight:48,minWidth:200}}>
              ▶ START MISSION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [state,dispatch]=useReducer(reducer,undefined,makeInitialState);
  const [started,setStarted]=useState(false);
  const completedCount=state.completedPuzzles.length;
  const panelW="min(272px,35vw)";

  return (
    <GameCtx.Provider value={{state,dispatch}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:none;opacity:1}}
        @keyframes shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-6px)}30%{transform:translateX(6px)}45%{transform:translateX(-5px)}60%{transform:translateX(5px)}75%{transform:translateX(-3px)}90%{transform:translateX(3px)}}
        .shake{animation:shake 0.55s ease;}
        *{box-sizing:border-box;}body{margin:0;}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0a0f1e}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px}
        input,button{-webkit-tap-highlight-color:transparent;}
      `}</style>

      {!started ? (
        <IntroScreen onStart={()=>setStarted(true)}/>
      ) : (
        <div style={{position:"fixed",inset:0,background:"#040814",overflow:"hidden",fontFamily:"system-ui,sans-serif"}}>
          {/* Full-width header */}
          <div style={{position:"absolute",top:0,left:0,right:0,height:44,background:"rgba(4,8,20,0.95)",borderBottom:"1px solid #0f2040",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",zIndex:150}}>
            <div style={{color:"#22d3ee",fontSize:"clamp(10px,2vw,13px)",fontWeight:700,letterSpacing:2}}>BINARY CODE ESCAPE</div>
            <div style={{display:"flex",gap:"clamp(8px,2vw,20px)",alignItems:"center"}}>
              <span style={{color:"#475569",fontSize:"clamp(10px,1.5vw,12px)"}}>Score: <span style={{color:"#22d3ee",fontWeight:700}}>{state.score}</span></span>
              <span style={{color:"#475569",fontSize:"clamp(10px,1.5vw,12px)"}}>Hints: <span style={{color:"#fbbf24",fontWeight:700}}>{state.hintsRemaining}</span></span>
              <span style={{color:"#475569",fontSize:"clamp(10px,1.5vw,12px)"}}>Attempts: <span style={{color:"#f472b6",fontWeight:700}}>{state.attempts}</span></span>
              <span style={{color:"#475569",fontSize:"clamp(10px,1.5vw,12px)"}}>{completedCount}/6</span>
            </div>
          </div>

          {/* Room */}
          <div style={{position:"absolute",inset:0,paddingLeft:panelW,paddingTop:44,overflow:"hidden"}}>
            <RoomScene completedCount={completedCount} roomObjects={state.roomObjects} onClickObject={id=>dispatch({type:"OPEN_PUZZLE",puzzleId:id})}/>
          </div>

          {/* Exit door tap overlay */}
          {completedCount>=6&&(
            <div onClick={()=>dispatch({type:"OPEN_PUZZLE",puzzleId:"__exit__"})}
              style={{position:"absolute",cursor:"pointer",zIndex:60,
                left:`calc(${panelW} + (393/900) * (100% - ${panelW}))`,
                top:`calc(44px + (158/600) * (100% - 44px))`,
                width:`calc((114/900) * (100% - ${panelW}))`,
                height:`calc((210/600) * (100% - 44px))`}}/>
          )}

          <Terminal/>
          <ActivePuzzle/>
          <Notifications notifications={state.notifications} dispatch={dispatch}/>
          {state.gameComplete&&<CompletionScreen/>}
        </div>
      )}
    </GameCtx.Provider>
  );
}