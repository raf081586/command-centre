import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

const API = "/api/claude";

const EARN_SYSTEM = `You are an expert solution consultant helping log a prospect engagement into Salesforce. Your tone is efficient, clear, and helpful. YOU ALWAYS USE BRITISH ENGLISH ONLY. NEVER USE AMERICAN ENGLISH.

You collect information step by step. You ask ONE question at a time and wait for the answer before proceeding. You never skip steps or make up information.

The steps are fixed and you must follow them exactly in order:
STEP 1 (engagement type): Ask exactly — "What type of engagement was this? (e.g., Discovery, Demo, Tech Deep Dive, RFP) and what status does it have (Green, Amber, Red)"
STEP 2 (recent events): Ask exactly — "Let's start with Recent Events. Tell me about the activity. What did we learn? Feel free to use bullet points."
STEP 3 (audience): Ask exactly — "Next, Participating Audience (Roles) — who attended and who was missing?"
STEP 4 (risks): Ask exactly — "What would stop them moving forward with Workday? Do we have the right engagement for success?"
STEP 5 (next steps): Ask exactly — "Finally, Next Steps. What are the follow up activities for presales and when?"
STEP 6 (output): Once you have all five answers, synthesise them into the output format below. Use British English throughout. Do not use American spellings. Do not add preamble, thanks, or explanation. Output ONLY:

[Today's date as Nth Month YYYY], RF, [Engagement Type], [Status]

Recent Events
[synthesised summary of recent events]

Participating Audience (Roles)
[synthesised summary of audience]

Potential Risks
[synthesised summary of risks]

Next Steps
[synthesised summary of next steps]
______________________________________

IMPORTANT RULES:
- Never invent or assume any information. Only use what the user tells you.
- Ask exactly one question per message.
- Do not combine multiple questions in one message.
- Do not produce the final output until you have collected all five pieces of information.
- Always use British English: "recognised" not "recognized", "colour" not "color", "whilst" not "while", etc.`;

// ── Date helpers ──────────────────────────────────────────────────────
const TODAY    = new Date();
const addDays  = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const fmtDay   = d=>d.toLocaleDateString("en-GB",{weekday:"short"});
const fmtShort = d=>d.toLocaleDateString("en-GB",{day:"numeric",month:"short"});
const fmtFull  = d=>d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
const toInputDate  = d=>d.toISOString().slice(0,10);
const fromInputDate= s=>{ const d=new Date(s); d.setHours(12); return d; };
const getMonday = d=>{ const x=new Date(d); const day=x.getDay(); x.setDate(x.getDate()+(day===0?-6:1-day)); return x; };
const MONDAY   = getMonday(TODAY);
const todayStr = TODAY.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

const buildCols=()=>{
  const mon=getMonday(TODAY);
  const isToday=d=>d.toDateString()===TODAY.toDateString();
  const dayLabel=d=>isToday(d)?"Today":d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric"});
  return [
    {id:"urgent",label:"Urgent",           accent:"#ef4444",date:TODAY},
    {id:"mon",   label:dayLabel(mon),       accent:isToday(mon)?"#f97316":"#8b5cf6",date:mon},
    {id:"tue",   label:dayLabel(addDays(mon,1)),accent:isToday(addDays(mon,1))?"#f97316":"#8b5cf6",date:addDays(mon,1)},
    {id:"wed",   label:dayLabel(addDays(mon,2)),accent:isToday(addDays(mon,2))?"#f97316":"#8b5cf6",date:addDays(mon,2)},
    {id:"thu",   label:dayLabel(addDays(mon,3)),accent:isToday(addDays(mon,3))?"#f97316":"#8b5cf6",date:addDays(mon,3)},
    {id:"fri",   label:dayLabel(addDays(mon,4)),accent:isToday(addDays(mon,4))?"#f97316":"#8b5cf6",date:addDays(mon,4)},
    {id:"later", label:"Later",             accent:"#3b82f6",date:null},
    {id:"done",  label:"Done",              accent:"#22c55e",date:null},
  ];
};
const BOARD_COLS=buildCols();

const STAGE_C={
  "Discovery":  {bg:"#1a3a5c",c:"#7ab8f5"},
  "Proposal":   {bg:"#3a2e0a",c:"#f5c842"},
  "Negotiation":{bg:"#2a1a5c",c:"#a78bfa"},
  "Closed Won": {bg:"#0a3020",c:"#4ade80"},
  "Closed Lost":{bg:"#3a1010",c:"#f87171"},
};
const CAT_C={
  work:    {bg:"#1a2a4a",c:"#60a5fa",b:"#3b82f6"},
  urgent:  {bg:"#3a1515",c:"#f87171",b:"#ef4444"},
  home:    {bg:"#0f2a1a",c:"#4ade80",b:"#22c55e"},
  personal:{bg:"#2a1a0a",c:"#fb923c",b:"#f97316"},
  admin:   {bg:"#1e1a3a",c:"#a78bfa",b:"#8b5cf6"},
};
const DEF_CC={bg:"#1e2030",c:"#9ca3af",b:"#4b5563"};
const catC=c=>CAT_C[c]||DEF_CC;

const BG="#0f1117",BG2="#161b27",BG3="#1c2133";
const BOR="rgba(255,255,255,0.07)",BOR2="rgba(255,255,255,0.12)";
const ACC="#7c6fff",ACL="rgba(124,111,255,0.15)";
const TX="#e2e8f0",TXS="#8892a4",TXM="#c4cad4";

const TAB_ITEMS=[
  {k:"dashboard",lb:"Home", em:"🏠"},
  {k:"opps",     lb:"Opps", em:"💼"},
  {k:"todos",    lb:"Board",em:"🗂️"},
  {k:"calendar", lb:"Cal",  em:"📅"},
  {k:"news",     lb:"News", em:"📰"},
  {k:"earn",     lb:"EARN", em:"✨"},
];

const CAL_SAMPLE=[
  {id:1,offset:0,time:"09:00",title:"Acme intro call",     type:"call"},
  {id:2,offset:0,time:"14:00",title:"Team standup",        type:"internal"},
  {id:3,offset:1,time:"10:30",title:"Globex discovery",    type:"call"},
  {id:4,offset:2,time:"11:00",title:"Initech negotiation", type:"call"},
  {id:5,offset:2,time:"15:00",title:"Forecast review",     type:"internal"},
  {id:6,offset:3,time:"09:30",title:"QBR prep",            type:"internal"},
  {id:7,offset:4,time:"13:00",title:"Umbrella check-in",   type:"call"},
];
const CAL=CAL_SAMPLE.map(e=>({...e,date:addDays(MONDAY,e.offset)}));

// ── BBC News ──────────────────────────────────────────────────────────
const fetchBBC=async()=>{
  try{
    const res=await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent("https://feeds.bbci.co.uk/news/business/rss.xml")}`);
    const json=await res.json();
    if(json.status==="ok"&&json.items?.length)
      return json.items.slice(0,8).map(i=>({title:i.title,desc:(i.description||"").replace(/<[^>]+>/g,""),link:i.link}));
  }catch{}
  try{
    const res=await fetch(`https://corsproxy.io/?url=${encodeURIComponent("https://feeds.bbci.co.uk/news/business/rss.xml")}`);
    const text=await res.text();
    const xml=new DOMParser().parseFromString(text,"text/xml");
    return Array.from(xml.querySelectorAll("item")).slice(0,8).map(i=>({
      title:i.querySelector("title")?.textContent||"",
      desc:(i.querySelector("description")?.textContent||"").replace(/<[^>]+>/g,""),
      link:i.querySelector("link")?.textContent||"#",
    }));
  }catch{}
  return null;
};

const claudeCall=async(messages,system="")=>{
  const body={model:"mistral-small-latest",max_tokens:800,messages};
  if(system)body.system=system;
  const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json();
  return{text:data.content?.map(c=>c.text||"").join("")||"",usage:data.usage};
};

const summariseNews=async articles=>{
  try{
    const {text}=await claudeCall([{role:"user",content:`Summarise each headline into one plain sentence max 12 words. Return ONLY a JSON array like [{"title":"...","summary":"..."}]. No markdown.\n\n${articles.map((a,i)=>`${i+1}. ${a.title}: ${a.desc.slice(0,120)}`).join("\n")}`}]);
    return JSON.parse(text.replace(/```json|```/g,"").trim());
  }catch{return null;}
};

const generateTLDR=async articles=>{
  try{
    const {text}=await claudeCall([{role:"user",content:`Write a single 2-3 sentence TL;DR summary of today's top business news based on these headlines. Be concise and direct. British English only.\n\n${articles.map(a=>a.title).join("\n")}`}]);
    return text.trim();
  }catch{return null;}
};

// ── Weather ───────────────────────────────────────────────────────────
const WMO_CODES={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Foggy",48:"Foggy",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Showers",81:"Showers",82:"Heavy showers",95:"Thunderstorm",96:"Thunderstorm",99:"Thunderstorm"};
const WMO_ICON={0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",51:"🌦️",53:"🌦️",55:"🌧️",61:"🌦️",63:"🌧️",65:"🌧️",71:"🌨️",73:"❄️",75:"❄️",80:"🌧️",81:"🌧️",82:"⛈️",95:"⛈️",96:"⛈️",99:"⛈️"};

const fetchWeather=async(lat,lon,label)=>{
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
    const res=await fetch(url);
    const d=await res.json();
    const code=d.current.weathercode;
    return{label,temp:Math.round(d.current.temperature_2m),icon:WMO_ICON[code]||"🌡️",desc:WMO_CODES[code]||"",wind:Math.round(d.current.windspeed_10m),rain:d.daily.precipitation_probability_max[0]||0,hi:Math.round(d.daily.temperature_2m_max[0]),lo:Math.round(d.daily.temperature_2m_min[0])};
  }catch{return null;}
};

const AEField=({value,onChange,list,placeholder,id})=>(
  <div>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} list={id}/>
    <datalist id={id}>{list.map(n=><option key={n} value={n}/>)}</datalist>
  </div>
);

export default function App(){
  const [tab,setTab]                    =useState("dashboard");
  const [opps,setOpps]                  =useState([]);
  const [dbReady,setDbReady]            =useState(false);
  const [selOpp,setSelOpp]              =useState(null);
  const [oppDetailOpen,setOppDetailOpen]=useState(false);
  const [showAddOpp,setShowAddOpp]      =useState(false);
  const [editingOpp,setEditingOpp]      =useState(null);
  const [newOpp,setNewOpp]              =useState({name:"",stage:"Discovery",value:"",wdAE:"",vndlyAE:""});
  const [filterStage,setFilterStage]    =useState("all");
  const [filterVndly,setFilterVndly]    =useState("all");
  const [todos,setTodos]                =useState([]);
  const [cats,setCats]                  =useState(["work","urgent","home","personal","admin"]);
  const [newCat,setNewCat]              =useState("");
  const [showNewCat,setShowNewCat]      =useState(false);
  const [newTodo,setNewTodo]            =useState("");
  const [newTodoCat,setNewTodoCat]      =useState("work");
  const [addingToCol,setAddingToCol]    =useState(null);
  const [dragId,setDragId]              =useState(null);
  const [dragOver,setDragOver]          =useState(null);
  const [noteText,setNoteText]          =useState("");
  const [noteVis,setNoteVis]            =useState("me");
  const [noteDate,setNoteDate]          =useState(toInputDate(TODAY));
  const [sessCost,setSessCost]          =useState(0);
  const [reminder,setReminder]          =useState("Follow up with Acme Corp — due today");
  const [earnMsgs,setEarnMsgs]          =useState([]);
  const [earnInput,setEarnInput]        =useState("");
  const [earnLoading,setEarnLoading]    =useState(false);
  const [shareModal,setShareModal]      =useState(false);
  const [calMsg,setCalMsg]              =useState(false);
  const [news,setNews]                  =useState([]);
  const [tldr,setTldr]                  =useState("");
  const [newsLoading,setNewsLoading]    =useState(false);
  const [newsError,setNewsError]        =useState(false);
  const [londonWx,setLondonWx]          =useState(null);
  const [localWx,setLocalWx]            =useState(null);
  const earnRef=useRef(null);
  const isMobile=window.innerWidth<768;

  const wdAEList  =[...new Set(opps.map(o=>o.wdAE).filter(Boolean))];
  const vndlyAEList=[...new Set(opps.map(o=>o.vndlyAE).filter(Boolean))];

  // ── Supabase loaders ──────────────────────────────────────────────
  const loadOpps=async()=>{
    const {data,error}=await supabase.from("opps").select("*, notes(*)").order("created_at");
    if(error){ console.error("Supabase opps error:",error); return; }
    if(data) setOpps(data.map(o=>({
      ...o, wdAE:o.wd_ae||"", vndlyAE:o.vndly_ae||"", last:o.last_activity||"Just now",
      notes:(o.notes||[]).sort((a,b)=>new Date(b.note_date)-new Date(a.note_date)).map(n=>({
        ...n, date:new Date(n.note_date), dateStr:fmtFull(new Date(n.note_date))
      }))
    })));
    setDbReady(true);
  };

  const loadTodos=async()=>{
    const {data,error}=await supabase.from("todos").select("*").order("created_at");
    if(error){ console.error("Supabase todos error:",error); return; }
    if(data) setTodos(data);
  };

  const dbAddOpp=async(opp)=>{
    const {data}=await supabase.from("opps").insert({name:opp.name,stage:opp.stage,value:opp.value,wd_ae:opp.wdAE,vndly_ae:opp.vndlyAE,last_activity:"Just now"}).select().single();
    if(data) setOpps(p=>[...p,{...data,wdAE:data.wd_ae,vndlyAE:data.vndly_ae,last:data.last_activity,notes:[]}]);
  };

  const dbUpdateOpp=async(id,fields)=>{
    await supabase.from("opps").update({name:fields.name,stage:fields.stage,value:fields.value,wd_ae:fields.wdAE,vndly_ae:fields.vndlyAE,last_activity:"Just now"}).eq("id",id);
    setOpps(p=>p.map(o=>o.id===id?{...o,...fields,last:"Just now"}:o));
  };

  const dbAddNote=async(oppId)=>{
    if(!noteText.trim())return;
    const d=fromInputDate(noteDate);
    const {data}=await supabase.from("notes").insert({opp_id:oppId,text:noteText,vis:noteVis,note_date:d.toISOString()}).select().single();
    if(data){
      const newNote={...data,date:d,dateStr:fmtFull(d)};
      setOpps(p=>p.map(o=>{
        if(o.id!==oppId)return o;
        const updated=[...o.notes,newNote].sort((a,b)=>new Date(b.date)-new Date(a.date));
        return{...o,notes:updated};
      }));
    }
    setNoteText("");setNoteDate(toInputDate(TODAY));
  };

  const dbUpdateNoteDate=async(oppId,nid,newDateStr)=>{
    const d=fromInputDate(newDateStr);
    await supabase.from("notes").update({note_date:d.toISOString()}).eq("id",nid);
    setOpps(p=>p.map(o=>{
      if(o.id!==oppId)return o;
      const updated=o.notes.map(n=>n.id===nid?{...n,date:d,dateStr:fmtFull(d)}:n).sort((a,b)=>new Date(b.date)-new Date(a.date));
      return{...o,notes:updated};
    }));
  };

  const dbTogNoteVis=async(oppId,nid,vis)=>{
    await supabase.from("notes").update({vis}).eq("id",nid);
    setOpps(p=>p.map(o=>o.id===oppId?{...o,notes:o.notes.map(n=>n.id===nid?{...n,vis}:n)}:o));
  };

  const dbAddTodo=async(text,col,cat)=>{
    const {data}=await supabase.from("todos").insert({text,col,cat,done:col==="done"}).select().single();
    if(data) setTodos(p=>[...p,data]);
  };

  const dbMoveTodo=async(id,toCol)=>{
    await supabase.from("todos").update({col:toCol,done:toCol==="done"}).eq("id",id);
    setTodos(p=>p.map(t=>t.id===id?{...t,col:toCol,done:toCol==="done"}:t));
  };

  const dbUpdateTodo=async(id,text,cat)=>{
    await supabase.from("todos").update({text,cat}).eq("id",id);
    setTodos(p=>p.map(t=>t.id===id?{...t,text,cat}:t));
  };

  const dbDeleteTodo=async(id)=>{
    await supabase.from("todos").delete().eq("id",id);
    setTodos(p=>p.filter(t=>t.id!==id));
  };

  useEffect(()=>{
    const c=localStorage.getItem("scc_cost3"); if(c)setSessCost(parseFloat(c)||0);
    loadOpps(); loadTodos(); loadNews(); loadWeather();
  },[]);

  useEffect(()=>{ if(earnRef.current)earnRef.current.scrollTop=earnRef.current.scrollHeight; },[earnMsgs]);

  const loadWeather=async()=>{
    const [london,mktob]=await Promise.all([
      fetchWeather(51.5074,-0.1278,"London"),
      fetchWeather(47.7764,10.6207,"Marktoberdorf"),
    ]);
    setLondonWx(london); setLocalWx(mktob);
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(async pos=>{
        const {latitude:lat,longitude:lon}=pos.coords;
        try{
          const distLon=Math.sqrt(Math.pow((lat-51.5074)*111,2)+Math.pow((lon+0.1278)*69,2));
          const distMkt=Math.sqrt(Math.pow((lat-47.7764)*111,2)+Math.pow((lon-10.6207)*69,2));
          if(distLon>30&&distMkt>30){
            const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
            const d=await r.json();
            const label=d.address?.city||d.address?.town||d.address?.village||"Current location";
            const wx=await fetchWeather(lat,lon,label);
            if(wx) setLocalWx(wx);
          }
        }catch{}
      },()=>{});
    }
  };

  const loadNews=async()=>{
    setNewsLoading(true);setNewsError(false);setNews([]);setTldr("");
    const articles=await fetchBBC();
    if(!articles){setNewsError(true);setNewsLoading(false);return;}
    const [summaries,tldrText]=await Promise.all([summariseNews(articles),generateTLDR(articles)]);
    if(tldrText)setTldr(tldrText);
    if(summaries?.length) setNews(summaries.map((s,i)=>({...s,link:articles[i]?.link||"#"})));
    else setNews(articles.map(a=>({title:a.title,summary:a.desc.slice(0,100),link:a.link})));
    setNewsLoading(false);
  };

  const addTok=(i,o)=>{
    const cost=(i/1e6)*3+(o/1e6)*15;
    setSessCost(p=>{const n=p+cost;localStorage.setItem("scc_cost3",n.toFixed(6));return n;});
  };

  const addOpp=()=>{
    if(!newOpp.name.trim())return;
    dbAddOpp(newOpp);
    setNewOpp({name:"",stage:"Discovery",value:"",wdAE:"",vndlyAE:""});
    setShowAddOpp(false);
  };

  const saveOppEdit=(id,fields)=>dbUpdateOpp(id,fields);
  const moveTodo=(id,toCol)=>dbMoveTodo(id,toCol);
  const addNote=(oppId)=>dbAddNote(oppId);
  const updateNoteDate=(oppId,nid,newDateStr)=>dbUpdateNoteDate(oppId,nid,newDateStr);
  const togNoteVis=(oppId,nid,vis)=>dbTogNoteVis(oppId,nid,vis);

  const getStepReminder=(msgCount)=>{
    if(msgCount===0)return "You are at STEP 1. Introduce yourself briefly then ask the STEP 1 question.";
    if(msgCount===1)return "You are at STEP 2. Ask the STEP 2 question only. Do not add anything else.";
    if(msgCount===2)return "You are at STEP 3. Ask the STEP 3 question only. Do not add anything else.";
    if(msgCount===3)return "You are at STEP 4. Ask the STEP 4 question only. Do not add anything else.";
    if(msgCount===4)return "You are at STEP 5. Ask the STEP 5 question only. Do not add anything else.";
    return "You now have all five answers. Proceed to STEP 6 and produce the final output only. No preamble.";
  };

  const sendEARN=async msg=>{
    const assistantMsgCount=earnMsgs.filter(m=>m.role==="assistant").length;
    const reminder=getStepReminder(assistantMsgCount);
    const augmentedMsg=msg==="Start"?`[${reminder}]`:`${msg}\n\n[${reminder}]`;
    const msgs=[...earnMsgs,{role:"user",content:augmentedMsg}];
    setEarnMsgs(p=>[...p,{role:"user",content:msg}]);
    setEarnInput("");setEarnLoading(true);
    try{
      const {text,usage}=await claudeCall(msgs,EARN_SYSTEM);
      setEarnMsgs(p=>[...p,{role:"assistant",content:text||"Error."}]);
      if(usage)addTok(usage.input_tokens,usage.output_tokens);
    }catch(e){setEarnMsgs(p=>[...p,{role:"assistant",content:"Error: "+e.message}]);}
    setEarnLoading(false);
  };

  const startEARN=opp=>{setEarnMsgs([]);setTab("earn");setTimeout(()=>sendEARN(`Initiate EARN note. Opportunity: ${opp.name}, Stage: ${opp.stage}, Value: ${opp.value}`),50);};

  const filteredOpps=opps.filter(o=>(filterStage==="all"||o.stage===filterStage)&&(filterVndly==="all"||o.vndlyAE===filterVndly));
  const curOpp=opps.find(o=>o.id===selOpp);
  const openCount=todos.filter(t=>!t.done).length;
  const visC=v=>v==="me"?{bg:"rgba(124,111,255,0.2)",c:"#a78bfa"}:v==="ae"?{bg:"rgba(251,146,60,0.2)",c:"#fb923c"}:{bg:"rgba(74,222,128,0.2)",c:"#4ade80"};
  const card={background:BG2,border:`1px solid ${BOR}`,borderRadius:12,padding:"14px 16px"};
  const badge=(bg,c)=>({background:bg,color:c,fontSize:11,padding:"2px 8px",borderRadius:4,fontWeight:500,display:"inline-block"});
  const calDays=BOARD_COLS.slice(1,6).map(col=>({label:col.label,date:col.date,events:CAL.filter(e=>e.date.toDateString()===col.date?.toDateString())}));

  const WxCard=({wx})=>wx?(
    <div style={{background:BG3,border:`1px solid ${BOR}`,borderRadius:10,padding:"10px 12px",flex:1,minWidth:120}}>
      <div style={{fontSize:11,color:TXS,marginBottom:4}}>{wx.label}</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:26}}>{wx.icon}</span>
        <div>
          <div style={{fontSize:18,fontWeight:500,color:TX}}>{wx.temp}°C</div>
          <div style={{fontSize:11,color:TXS}}>{wx.desc}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:6,fontSize:11,color:TXS,flexWrap:"wrap"}}>
        <span>↑{wx.hi}° ↓{wx.lo}°</span>
        <span>💨{wx.wind}km/h</span>
        <span>🌧️{wx.rain}%</span>
      </div>
    </div>
  ):null;

  const OppEditForm=({opp,onSave,onCancel})=>{
    const [f,setF]=useState({name:opp.name,stage:opp.stage,value:opp.value,wdAE:opp.wdAE,vndlyAE:opp.vndlyAE});
    return(
      <div style={{...card,background:BG3,marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:500,color:TXM,marginBottom:10}}>Edit opportunity</div>
        <input value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="Company name" style={{marginBottom:8}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <input value={f.value} onChange={e=>setF(p=>({...p,value:e.target.value}))} placeholder="Value"/>
          <select value={f.stage} onChange={e=>setF(p=>({...p,stage:e.target.value}))}>
            {Object.keys(STAGE_C).map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <AEField value={f.wdAE} onChange={v=>setF(p=>({...p,wdAE:v}))} list={wdAEList} placeholder="Workday AE" id="edit-wd-ae"/>
          <AEField value={f.vndlyAE} onChange={v=>setF(p=>({...p,vndlyAE:v}))} list={vndlyAEList} placeholder="VNDLY AE" id="edit-vndly-ae"/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onSave(f)} style={{flex:1,padding:"7px",borderRadius:8,background:ACC,color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontWeight:500}}>Save</button>
          <button onClick={onCancel} style={{padding:"7px 12px",borderRadius:8,border:`1px solid ${BOR2}`,background:"transparent",color:TXS,cursor:"pointer",fontSize:13}}>Cancel</button>
        </div>
      </div>
    );
  };

  const TodoCard=({t})=>{
    const [editing,setEditing]=useState(false);
    const [text,setText]=useState(t.text);
    const [cat,setCatLocal]=useState(t.cat);
    const taRef=useRef(null);
    useEffect(()=>{
      if(editing&&taRef.current){
        taRef.current.style.height="auto";
        taRef.current.style.height=Math.max(taRef.current.scrollHeight, 52)+"px";
      }
    },[editing,text]);
    const handleTextChange=e=>{
      setText(e.target.value);
      e.target.style.height="auto";
      e.target.style.height=Math.max(e.target.scrollHeight, 52)+"px";
    };
    if(editing) return(
      <div style={{background:BG2,border:`1px solid ${ACC}`,borderRadius:7,padding:"8px",marginBottom:5}}>
        <textarea ref={taRef} value={text} onChange={handleTextChange}
          rows={2}
          style={{marginBottom:"6px !important",fontSize:"12px !important",padding:"6px 7px !important",resize:"none",overflow:"hidden",minHeight:52,lineHeight:1.5,wordBreak:"break-word"}}/>
        <select value={cat} onChange={e=>setCatLocal(e.target.value)} style={{marginBottom:"6px !important",fontSize:"11px !important",padding:"3px 6px !important"}}>
          {cats.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>{dbUpdateTodo(t.id,text,cat);setEditing(false);}} style={{flex:1,fontSize:11,padding:"4px",borderRadius:5,background:ACC,color:"#fff",border:"none",cursor:"pointer"}}>Save</button>
          <button onClick={()=>dbDeleteTodo(t.id)} style={{fontSize:11,padding:"4px 6px",borderRadius:5,background:"rgba(239,68,68,0.15)",border:"1px solid #ef4444",color:"#f87171",cursor:"pointer"}}>Del</button>
          <button onClick={()=>setEditing(false)} style={{fontSize:11,padding:"4px 6px",borderRadius:5,background:"transparent",border:`1px solid ${BOR2}`,color:TXS,cursor:"pointer"}}>✕</button>
        </div>
      </div>
    );
    return(
      <div draggable onDragStart={()=>setDragId(t.id)}
        style={{background:BG2,border:`1px solid ${BOR}`,borderRadius:7,padding:"7px 8px",marginBottom:5,cursor:"grab",opacity:t.done?0.5:1,userSelect:"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:4,marginBottom:4}}>
          <div style={{fontSize:12,color:t.done?TXS:TXM,textDecoration:t.done?"line-through":"none",lineHeight:1.4,flex:1,wordBreak:"break-word"}}>{t.text}</div>
          <button onClick={()=>setEditing(true)} style={{background:"none",border:"none",cursor:"pointer",color:TXS,fontSize:12,padding:0,flexShrink:0,lineHeight:1}}>✎</button>
        </div>
        <span style={{fontSize:10,padding:"1px 5px",borderRadius:8,background:catC(t.cat).bg,color:catC(t.cat).c}}>{t.cat}</span>
      </div>
    );
  };

  const NotePanel=({opp})=>(
    <div>
      <div style={{fontSize:13,fontWeight:500,color:TXM,marginBottom:10}}>Notes</div>
      {opp.notes.length===0&&<div style={{fontSize:13,color:TXS,marginBottom:10}}>No notes yet.</div>}
      {opp.notes.map(n=>(
        <div key={n.id} style={{background:BG3,borderRadius:10,padding:"12px 14px",marginBottom:10,border:`1px solid ${BOR}`}}>
          <div style={{fontSize:15,color:TX,lineHeight:1.6,marginBottom:10}}>{n.text}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <input type="date" defaultValue={toInputDate(new Date(n.date))}
              onChange={e=>updateNoteDate(opp.id,n.id,e.target.value)}
              style={{fontSize:"11px !important",padding:"2px 6px !important",width:"auto !important",background:`${BG2} !important`,color:`${TXS} !important`,border:`1px solid ${BOR2} !important`,borderRadius:"4px !important",cursor:"pointer"}}/>
            <span style={{fontSize:11,color:TXS}}>{n.dateStr}</span>
            <select value={n.vis} onChange={e=>togNoteVis(opp.id,n.id,e.target.value)}
              style={{fontSize:"11px !important",padding:"2px 6px !important",width:"auto !important",background:`${visC(n.vis).bg} !important`,color:`${visC(n.vis).c} !important`,border:"none !important",borderRadius:"4px !important",cursor:"pointer",marginLeft:"auto"}}>
              <option value="me">Only me</option><option value="ae">Me + AE</option><option value="manager">All</option>
            </select>
          </div>
        </div>
      ))}
      <div style={{background:BG3,borderRadius:10,padding:"12px 14px",border:`1px solid ${BOR2}`,marginTop:4}}>
        <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Add a note…"
          style={{height:72,resize:"none",marginBottom:"8px !important",fontSize:"14px !important"}}/>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <input type="date" value={noteDate} onChange={e=>setNoteDate(e.target.value)}
            style={{fontSize:"11px !important",padding:"3px 6px !important",width:"auto !important",flex:"0 0 auto"}}/>
          <select value={noteVis} onChange={e=>setNoteVis(e.target.value)}
            style={{fontSize:"11px !important",padding:"3px 6px !important",width:"auto !important",flex:"0 0 auto",background:`${visC(noteVis).bg} !important`,color:`${visC(noteVis).c} !important`}}>
            <option value="me">Only me</option><option value="ae">Me + AE</option><option value="manager">All</option>
          </select>
          <button onClick={()=>addNote(opp.id)} style={{marginLeft:"auto",padding:"6px 16px",borderRadius:8,background:ACC,color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontWeight:500}}>Save</button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{background:BG,minHeight:"100vh",    fontFamily:"system-ui,sans-serif",color:TX,paddingBottom:isMobile?80:0}}>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}
        input,textarea,select{background:${BG3}!important;color:${TX}!important;border:1px solid ${BOR2}!important;border-radius:8px!important;padding:8px 10px!important;font-size:14px!important;font-family:system-ui,sans-serif!important;outline:none;width:100%;}
        input:focus,textarea:focus,select:focus{border-color:${ACC}!important;}
        select option{background:${BG2};}
        button{font-family:system-ui,sans-serif;}
        input[type="date"]{color-scheme:dark;}
      `}</style>

      {reminder&&(
        <div style={{background:"rgba(251,146,60,0.1)",borderBottom:"1px solid rgba(251,146,60,0.2)",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <span style={{fontSize:13,color:"#fb923c",flex:1}}>🔔 {reminder}</span>
          <button onClick={()=>setReminder(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#fb923c",fontSize:20,lineHeight:1,padding:0}}>×</button>
        </div>
      )}

      <div style={{background:BG2,borderBottom:`1px solid ${BOR}`,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:40}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{background:ACL,border:`1px solid ${ACC}`,borderRadius:8,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🚀</div>
          <span style={{fontWeight:500,fontSize:14,color:TX}}>Command Centre</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{background:BG3,border:`1px solid ${BOR}`,borderRadius:8,padding:"4px 10px",fontSize:12,color:TXS,display:"flex",alignItems:"center",gap:6}}>
            <span style={{color:ACC}}>⬡</span>
            <span style={{color:TX,fontWeight:500}}>${sessCost.toFixed(4)}</span>
            <div style={{width:32,height:3,background:"rgba(255,255,255,0.1)",borderRadius:2}}>
              <div style={{width:`${Math.min((sessCost/70)*100,100)}%`,height:"100%",background:sessCost/70>0.8?"#ef4444":ACC,borderRadius:2}}/>
            </div>
          </div>
          <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#7c6fff,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:500,color:"#fff"}}>R</div>
        </div>
      </div>

      <div style={{display:"flex",minHeight:"calc(100vh - 52px)"}}>
        {!isMobile&&(
          <nav style={{width:200,background:BG2,borderRight:`1px solid ${BOR}`,padding:"16px 12px",display:"flex",flexDirection:"column",gap:2,position:"sticky",top:52,height:"calc(100vh - 52px)",overflowY:"auto",flexShrink:0}}>
            {TAB_ITEMS.map(({k,em,lb})=>(
              <button key={k} onClick={()=>setTab(k)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:"none",background:tab===k?ACL:"transparent",color:tab===k?ACC:TXS,cursor:"pointer",fontSize:13,fontWeight:tab===k?500:400,width:"100%",textAlign:"left"}}>
                <span>{em}</span>{lb}
              </button>
            ))}
            <div style={{marginTop:"auto",padding:"12px",background:BG3,borderRadius:8,border:`1px solid ${BOR}`}}>
              <div style={{fontSize:11,color:TXS,marginBottom:4}}>14°C London</div>
              <div style={{fontSize:11,color:TXS}}>{todayStr}</div>
            </div>
          </nav>
        )}

        <main style={{flex:1,padding:isMobile?12:24,minWidth:0,overflowX:"hidden"}}>

          {tab==="dashboard"&&(
            <div>
              <div style={{...card,marginBottom:16,display:"flex",alignItems:"stretch",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                <div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
                  <div style={{fontSize:22,fontWeight:500,color:TX}}>Good morning 👋</div>
                  <div style={{fontSize:13,color:TXS,marginTop:4}}>{todayStr}</div>
                  <div style={{fontSize:13,color:TXM,marginTop:2}}>{openCount} open tasks</div>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  {londonWx?<WxCard wx={londonWx}/>:<div style={{fontSize:12,color:TXS,padding:"8px"}}>Loading weather…</div>}
                  {localWx&&<WxCard wx={localWx}/>}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
                <div style={card}>
                  <div style={{fontSize:12,fontWeight:500,color:TXS,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>Opportunities</div>
                  {!dbReady&&<div style={{fontSize:13,color:TXS}}>Connecting to database…</div>}
                  {dbReady&&opps.length===0&&<div style={{fontSize:13,color:TXS}}>No opportunities yet. Add one in the Opps tab.</div>}
                  {dbReady&&opps.slice(0,5).map(o=>(
                    <div key={o.id} onClick={()=>{setSelOpp(o.id);setTab("opps");setOppDetailOpen(true);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${BOR}`,cursor:"pointer",gap:8}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.name}</div>
                        <div style={{fontSize:11,color:TXS}}>{o.value}</div>
                      </div>
                      <span style={badge(STAGE_C[o.stage]?.bg,STAGE_C[o.stage]?.c)}>{o.stage}</span>
                    </div>
                  ))}
                </div>

                <div style={card}>
                  <div style={{fontSize:12,fontWeight:500,color:TXS,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>Open tasks</div>
                  {todos.filter(t=>!t.done).slice(0,5).map(t=>(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${BOR}`}}>
                      <input type="checkbox" onChange={()=>moveTodo(t.id,"done")} style={{flexShrink:0,accentColor:ACC,width:15,height:15}}/>
                      <span style={{fontSize:13,flex:1,color:TXM,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</span>
                      <span style={{...badge(catC(t.cat).bg,catC(t.cat).c),borderRadius:10,flexShrink:0}}>{t.cat}</span>
                    </div>
                  ))}
                </div>

                <div style={card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <span style={{fontSize:12,fontWeight:500,color:TXS,textTransform:"uppercase",letterSpacing:"0.06em"}}>This week</span>
                    <span style={{fontSize:11,color:TXS,background:BG3,padding:"2px 7px",borderRadius:5,border:`1px solid ${BOR}`}}>Connect calendar</span>
                  </div>
                  {CAL.slice(0,4).map(e=>(
                    <div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:`1px solid ${BOR}`}}>
                      <span style={{fontSize:11,color:TXS,minWidth:30}}>{fmtDay(e.date)}</span>
                      <span style={{fontSize:11,color:TXS,minWidth:34}}>{e.time}</span>
                      <span style={{width:6,height:6,borderRadius:3,background:e.type==="call"?ACC:"#4ade80",flexShrink:0}}/>
                      <span style={{fontSize:13,color:TXM,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</span>
                    </div>
                  ))}
                </div>

                <div style={card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:500,color:TXS,textTransform:"uppercase",letterSpacing:"0.06em"}}>BBC News</span>
                    <button onClick={loadNews} style={{fontSize:11,color:TXS,background:BG3,padding:"2px 7px",borderRadius:5,border:`1px solid ${BOR}`,cursor:"pointer"}}>↺</button>
                  </div>
                  {tldr&&<div style={{fontSize:12,color:TXM,lineHeight:1.5,marginBottom:8,padding:"8px",background:BG3,borderRadius:6,border:`1px solid ${BOR}`}}><span style={{color:ACC,fontWeight:500,fontSize:10,display:"block",marginBottom:3}}>TL;DR</span>{tldr}</div>}
                  {newsLoading&&<div style={{fontSize:13,color:TXS}}>Loading…</div>}
                  {!newsLoading&&!newsError&&news.slice(0,3).map((n,i)=>(
                    <a key={i} href={n.link} target="_blank" rel="noreferrer" style={{display:"block",padding:"6px 0",borderBottom:`1px solid ${BOR}`,textDecoration:"none"}}>
                      <div style={{fontSize:12,fontWeight:500,color:TXM}}>{n.title}</div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab==="opps"&&(
            <div>
              {(!oppDetailOpen||!isMobile)&&(
                <div style={isMobile?{}:{display:"grid",gridTemplateColumns:"300px 1fr",gap:16}}>
                  <div>
                    <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
                      <select value={filterStage} onChange={e=>setFilterStage(e.target.value)} style={{fontSize:"12px !important",padding:"4px 8px !important",flex:1,minWidth:100}}>
                        <option value="all">All stages</option>
                        {Object.keys(STAGE_C).map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      <select value={filterVndly} onChange={e=>setFilterVndly(e.target.value)} style={{fontSize:"12px !important",padding:"4px 8px !important",flex:1,minWidth:110}}>
                        <option value="all">All VNDLY AEs</option>
                        {vndlyAEList.map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                      <button onClick={()=>setShowAddOpp(p=>!p)} style={{fontSize:12,padding:"5px 12px",borderRadius:8,background:ACC,color:"#fff",border:"none",cursor:"pointer",fontWeight:500,flexShrink:0}}>+ Add</button>
                    </div>

                    {showAddOpp&&(
                      <div style={{...card,marginBottom:10,background:BG3}}>
                        <div style={{fontSize:13,fontWeight:500,color:TXM,marginBottom:10}}>New opportunity</div>
                        <input value={newOpp.name} onChange={e=>setNewOpp(p=>({...p,name:e.target.value}))} placeholder="Company name" style={{marginBottom:8}}/>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                          <input value={newOpp.value} onChange={e=>setNewOpp(p=>({...p,value:e.target.value}))} placeholder="Value e.g. £50,000"/>
                          <select value={newOpp.stage} onChange={e=>setNewOpp(p=>({...p,stage:e.target.value}))}>
                            {Object.keys(STAGE_C).map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                          <AEField value={newOpp.wdAE} onChange={v=>setNewOpp(p=>({...p,wdAE:v}))} list={wdAEList} placeholder="Workday AE" id="new-wd-ae"/>
                          <AEField value={newOpp.vndlyAE} onChange={v=>setNewOpp(p=>({...p,vndlyAE:v}))} list={vndlyAEList} placeholder="VNDLY AE" id="new-vndly-ae"/>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={addOpp} style={{flex:1,padding:"7px",borderRadius:8,background:ACC,color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontWeight:500}}>Save</button>
                          <button onClick={()=>setShowAddOpp(false)} style={{padding:"7px 12px",borderRadius:8,border:`1px solid ${BOR2}`,background:"transparent",color:TXS,cursor:"pointer",fontSize:13}}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {filteredOpps.map(o=>(
                      <div key={o.id}>
                        {editingOpp===o.id?(
                          <OppEditForm opp={o} onSave={f=>{saveOppEdit(o.id,f);setEditingOpp(null);}} onCancel={()=>setEditingOpp(null)}/>
                        ):(
                          <div onClick={()=>{setSelOpp(o.id);setOppDetailOpen(true);setEditingOpp(null);}} style={{...card,marginBottom:8,cursor:"pointer",border:selOpp===o.id?`1px solid ${ACC}`:`1px solid ${BOR}`}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                              <div style={{minWidth:0}}>
                                <div style={{fontSize:14,fontWeight:500,color:TX}}>{o.name}</div>
                                <div style={{fontSize:11,color:TXS,marginTop:2}}>{o.value}</div>
                              </div>
                              <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                                <span style={badge(STAGE_C[o.stage]?.bg,STAGE_C[o.stage]?.c)}>{o.stage}</span>
                                <button onClick={e=>{e.stopPropagation();setEditingOpp(o.id);}} style={{background:"none",border:"none",cursor:"pointer",color:TXS,fontSize:13,padding:0,lineHeight:1}}>✎</button>
                              </div>
                            </div>
                            <div style={{fontSize:11,color:TXS,marginTop:6,display:"flex",gap:10,flexWrap:"wrap"}}>
                              {o.wdAE&&<span>WD: {o.wdAE}</span>}
                              {o.vndlyAE&&<span>VNDLY: {o.vndlyAE}</span>}
                              <span>📝 {o.notes.length}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredOpps.length===0&&<div style={{fontSize:13,color:TXS,padding:"12px 0"}}>No opportunities match filters.</div>}
                  </div>

                  {selOpp&&curOpp&&!isMobile&&(
                    <div style={card}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                        <div>
                          <div style={{fontSize:16,fontWeight:500,color:TX}}>{curOpp.name}</div>
                          <div style={{fontSize:12,color:TXS,marginTop:2}}>
                            <span style={{...badge(STAGE_C[curOpp.stage]?.bg,STAGE_C[curOpp.stage]?.c),marginRight:6}}>{curOpp.stage}</span>
                            {curOpp.value}{curOpp.wdAE&&` · WD: ${curOpp.wdAE}`}{curOpp.vndlyAE&&` · VNDLY: ${curOpp.vndlyAE}`}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>startEARN(curOpp)} style={{fontSize:12,padding:"5px 10px",borderRadius:6,border:`1px solid ${ACC}`,cursor:"pointer",background:ACL,color:"#a78bfa",fontWeight:500}}>✨ EARN</button>
                          <button onClick={()=>setShareModal(true)} style={{fontSize:12,padding:"5px 10px",borderRadius:6,border:`1px solid ${BOR2}`,cursor:"pointer",background:BG3,color:TXS}}>Share</button>
                        </div>
                      </div>
                      <NotePanel opp={curOpp}/>
                    </div>
                  )}
                </div>
              )}

              {oppDetailOpen&&curOpp&&isMobile&&(
                <div style={card}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                    <button onClick={()=>setOppDetailOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:TXS,padding:0,fontSize:20,lineHeight:1,flexShrink:0}}>←</button>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:15,fontWeight:500,color:TX}}>{curOpp.name}</div>
                      <div style={{fontSize:12,color:TXS}}>{curOpp.value}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
                    <span style={badge(STAGE_C[curOpp.stage]?.bg,STAGE_C[curOpp.stage]?.c)}>{curOpp.stage}</span>
                    <button onClick={()=>startEARN(curOpp)} style={{fontSize:12,padding:"3px 10px",borderRadius:6,border:`1px solid ${ACC}`,cursor:"pointer",background:ACL,color:"#a78bfa",fontWeight:500}}>✨ EARN</button>
                    <button onClick={()=>setShareModal(true)} style={{fontSize:12,padding:"3px 10px",borderRadius:6,border:`1px solid ${BOR2}`,cursor:"pointer",background:BG3,color:TXS}}>Share</button>
                  </div>
                  <NotePanel opp={curOpp}/>
                </div>
              )}
            </div>
          )}

          {tab==="todos"&&(
            <div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                {cats.map(c=>(
                  <span key={c} style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:catC(c).bg,color:catC(c).c,border:`1px solid ${catC(c).b}`}}>{c}</span>
                ))}
                {showNewCat?(
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newCat.trim()){setCats(p=>[...p,newCat.trim().toLowerCase()]);setNewCat("");setShowNewCat(false);}}} placeholder="Name…" style={{width:"100px !important",padding:"3px 8px !important",fontSize:"12px !important",height:28}}/>
                    <button onClick={()=>{if(newCat.trim())setCats(p=>[...p,newCat.trim().toLowerCase()]);setNewCat("");setShowNewCat(false);}} style={{padding:"3px 8px",borderRadius:6,background:ACC,color:"#fff",border:"none",cursor:"pointer",fontSize:12,height:28}}>+</button>
                  </div>
                ):(
                  <button onClick={()=>setShowNewCat(true)} style={{fontSize:11,padding:"3px 10px",borderRadius:20,border:`1px dashed ${BOR2}`,background:"transparent",cursor:"pointer",color:TXS}}>+ Add</button>
                )}
              </div>
              <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:12,alignItems:"flex-start"}}>
                {BOARD_COLS.map(col=>{
                  const colItems=todos.filter(t=>t.col===col.id);
                  return(
                    <div key={col.id} style={{minWidth:160,maxWidth:160,flexShrink:0}}
                      onDragOver={e=>{e.preventDefault();setDragOver(col.id);}}
                      onDrop={e=>{e.preventDefault();if(dragId)moveTodo(dragId,col.id);setDragId(null);setDragOver(null);}}>
                      <div style={{background:dragOver===col.id?`${col.accent}18`:BG3,border:`1px solid ${dragOver===col.id?col.accent:BOR}`,borderRadius:10,padding:"10px 8px",minHeight:100,transition:"border-color .15s"}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                          <span style={{width:7,height:7,borderRadius:2,background:col.accent}}/>
                          <span style={{fontSize:12,fontWeight:500,color:TXM}}>{col.label}</span>
                          <span style={{marginLeft:"auto",fontSize:10,color:TXS,background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"1px 5px"}}>{colItems.length}</span>
                        </div>
                        {col.date&&<div style={{fontSize:10,color:TXS,marginBottom:8}}>{fmtShort(col.date)}</div>}
                        {colItems.map(t=><TodoCard key={t.id} t={t}/>)}
                        {addingToCol===col.id?(
                          <div>
                            <input value={newTodo} onChange={e=>setNewTodo(e.target.value)}
                              onKeyDown={e=>{if(e.key==="Enter"&&newTodo.trim()){dbAddTodo(newTodo,col.id,newTodoCat);setNewTodo("");setAddingToCol(null);}if(e.key==="Escape")setAddingToCol(null);}}
                              placeholder="Task…" autoFocus style={{marginBottom:"4px !important",fontSize:"12px !important",padding:"5px 7px !important"}}/>
                            <select value={newTodoCat} onChange={e=>setNewTodoCat(e.target.value)} style={{marginBottom:"4px !important",fontSize:"11px !important",padding:"3px 6px !important"}}>
                              {cats.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                            <div style={{display:"flex",gap:4}}>
                              <button onClick={()=>{if(newTodo.trim()){dbAddTodo(newTodo,col.id,newTodoCat);setNewTodo("");setAddingToCol(null);}}} style={{flex:1,fontSize:11,padding:"4px",borderRadius:5,background:ACC,color:"#fff",border:"none",cursor:"pointer"}}>Add</button>
                              <button onClick={()=>{setNewTodo("");setAddingToCol(null);}} style={{fontSize:11,padding:"4px 6px",borderRadius:5,background:"transparent",border:`1px solid ${BOR2}`,color:TXS,cursor:"pointer"}}>✕</button>
                            </div>
                          </div>
                        ):(
                          <button onClick={()=>setAddingToCol(col.id)} style={{width:"100%",fontSize:11,padding:"4px",borderRadius:6,background:"transparent",border:`1px dashed ${BOR2}`,color:TXS,cursor:"pointer",marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",gap:3}}>
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab==="calendar"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:15,fontWeight:500,color:TX}}>Week of {fmtShort(MONDAY)}</div>
                <button onClick={()=>setCalMsg(p=>!p)} style={{fontSize:11,color:TXS,background:BG3,padding:"4px 8px",borderRadius:6,border:`1px solid ${BOR}`,cursor:"pointer"}}>🔗 Connect calendar</button>
              </div>
              {calMsg&&(
                <div style={{...card,marginBottom:12,background:"rgba(124,111,255,0.08)",border:`1px solid ${ACC}`}}>
                  <div style={{fontSize:13,fontWeight:500,color:ACC,marginBottom:6}}>Connecting your calendar</div>
                  <div style={{fontSize:12,color:TXM,lineHeight:1.6}}>
                    Calendar sync requires OAuth — we'll set this up after Supabase.<br/>
                    <strong style={{color:TXM}}>Outlook:</strong> Register app at portal.azure.com → Microsoft Graph → Calendars.Read<br/>
                    <strong style={{color:TXM}}>Google:</strong> Create project at console.cloud.google.com → Calendar API → OAuth 2.0
                  </div>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {calDays.map(({label,date,events})=>(
                  <div key={label} style={{...card,border:date.toDateString()===TODAY.toDateString()?`1px solid ${ACC}`:`1px solid ${BOR}`}}>
                    <div style={{fontSize:12,fontWeight:500,color:date.toDateString()===TODAY.toDateString()?ACC:TXS,marginBottom:events.length?8:0,display:"flex",justifyContent:"space-between"}}>
                      <span style={{textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</span>
                      <span style={{fontWeight:400}}>{fmtShort(date)}</span>
                    </div>
                    {events.length===0&&<div style={{fontSize:12,color:TXS}}>No events</div>}
                    {events.map(e=>(
                      <div key={e.id} style={{display:"flex",gap:10,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${BOR}`}}>
                        <span style={{fontSize:12,color:TXS,minWidth:40}}>{e.time}</span>
                        <span style={{width:3,height:24,borderRadius:2,background:e.type==="call"?ACC:"#4ade80",flexShrink:0}}/>
                        <span style={{fontSize:13,color:TXM}}>{e.title}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==="news"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:15,fontWeight:500,color:TX}}>News digest</div>
                <button onClick={loadNews} style={{fontSize:11,color:TXS,background:BG3,padding:"4px 8px",borderRadius:6,border:`1px solid ${BOR}`,cursor:"pointer"}}>↺ Refresh</button>
              </div>
              {tldr&&(
                <div style={{...card,marginBottom:14,background:"rgba(124,111,255,0.08)",border:`1px solid ${ACC}`}}>
                  <div style={{fontSize:11,fontWeight:500,color:ACC,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>TL;DR — Today's business news</div>
                  <div style={{fontSize:14,color:TXM,lineHeight:1.6}}>{tldr}</div>
                </div>
              )}
              <div style={{...card,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:TXM,marginBottom:2}}>Company intranet</div>
                  <div style={{fontSize:11,color:TXS}}>Paste your intranet RSS URL to connect</div>
                </div>
                <span style={{fontSize:11,color:TXS,background:BG3,padding:"4px 8px",borderRadius:6,border:`1px solid ${BOR}`,flexShrink:0}}>Not connected</span>
              </div>
              {newsLoading&&<div style={{fontSize:13,color:TXS,padding:"20px 0",textAlign:"center"}}>Loading BBC News…</div>}
              {newsError&&<div style={{fontSize:13,color:"#f87171",padding:"20px 0",textAlign:"center"}}>Could not load news. Try refreshing.</div>}
              {!newsLoading&&!newsError&&news.map((n,i)=>(
                <a key={i} href={n.link} target="_blank" rel="noreferrer" style={{display:"block",textDecoration:"none"}}>
                  <div style={{...card,marginBottom:10}}>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                      <span style={badge("rgba(248,113,113,0.15)","#f87171")}>BBC</span>
                    </div>
                    <div style={{fontWeight:500,fontSize:13,color:TXM,marginBottom:3}}>{n.title}</div>
                    <div style={{fontSize:12,color:TXS,lineHeight:1.5}}>{n.summary}</div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {tab==="earn"&&(
            <div>
              <div style={{fontSize:15,fontWeight:500,color:TX,marginBottom:4}}>EARN note generator</div>
              <div style={{fontSize:12,color:TXS,marginBottom:14}}>AI-powered · British English · Salesforce-ready</div>
              {earnMsgs.length===0?(
                <div style={{...card,textAlign:"center",padding:"32px 16px"}}>
                  <div style={{fontSize:28,marginBottom:10}}>✨</div>
                  <div style={{fontSize:14,color:TXM,marginBottom:14}}>Start from an opportunity or begin fresh</div>
                  <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                    {opps.map(o=>(
                      <button key={o.id} onClick={()=>startEARN(o)} style={{fontSize:12,padding:"8px 12px",borderRadius:8,border:`1px solid ${BOR2}`,background:BG3,color:TXM,cursor:"pointer"}}>{o.name}</button>
                    ))}
                    <button onClick={()=>sendEARN("Start")} style={{fontSize:12,padding:"8px 12px",borderRadius:8,border:`1px solid ${ACC}`,background:ACL,color:"#a78bfa",cursor:"pointer",fontWeight:500}}>+ Fresh start</button>
                  </div>
                </div>
              ):(
                <div style={card}>
                  <div ref={earnRef} style={{maxHeight:400,overflowY:"auto",marginBottom:12,display:"flex",flexDirection:"column",gap:8}}>
                    {earnMsgs.map((m,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                        <div style={{maxWidth:"85%",background:m.role==="user"?ACL:BG3,border:`1px solid ${m.role==="user"?ACC:BOR}`,borderRadius:10,padding:"9px 12px",fontSize:13,color:TXM,lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {earnLoading&&(
                      <div style={{display:"flex"}}>
                        <div style={{background:BG3,border:`1px solid ${BOR}`,borderRadius:10,padding:"9px 14px",fontSize:13,color:TXS}}>Thinking…</div>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <input value={earnInput} onChange={e=>setEarnInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&earnInput.trim()&&sendEARN(earnInput)} placeholder="Your response…"/>
                    <button onClick={()=>earnInput.trim()&&sendEARN(earnInput)} style={{padding:"8px 14px",borderRadius:8,background:ACC,color:"#fff",border:"none",cursor:"pointer",fontWeight:500,flexShrink:0}}>Send</button>
                    <button onClick={()=>setEarnMsgs([])} style={{padding:"8px 10px",borderRadius:8,border:`1px solid ${BOR2}`,background:"transparent",color:TXS,cursor:"pointer",flexShrink:0}}>↺</button>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {isMobile&&(
        <nav style={{position:"fixed",bottom:0,left:0,right:0,background:BG2,borderTop:`1px solid ${BOR}`,display:"flex",zIndex:50,height:64,paddingBottom:"env(safe-area-inset-bottom, 8px)"}}>
          {TAB_ITEMS.map(({k,lb,em})=>(
            <button key={k} onClick={()=>{setTab(k);setOppDetailOpen(false);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,border:"none",background:"none",cursor:"pointer",color:tab===k?ACC:TXS,padding:"6px 0"}}>
              <span style={{fontSize:18}}>{em}</span>
              <span style={{fontSize:10,fontWeight:tab===k?500:400}}>{lb}</span>
            </button>
          ))}
        </nav>
      )}

      {shareModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",zIndex:999,padding:isMobile?"0 0 64px":0}} onClick={()=>setShareModal(false)}>
          <div style={{...card,width:"100%",maxWidth:400,borderRadius:isMobile?"12px 12px 0 0":12}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:500,fontSize:15,color:TX,marginBottom:14}}>Share notes</div>
            <input placeholder="Colleague's email…" style={{marginBottom:10}}/>
            <div style={{fontSize:12,color:TXS,marginBottom:12}}>Connect Slack or email for automatic sending</div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={()=>setShareModal(false)} style={{fontSize:13,padding:"8px 16px",borderRadius:8,border:`1px solid ${BOR2}`,background:"transparent",color:TXS,cursor:"pointer"}}>Cancel</button>
              <button onClick={()=>setShareModal(false)} style={{fontSize:13,padding:"8px 16px",borderRadius:8,background:ACC,color:"#fff",border:"none",cursor:"pointer"}}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}