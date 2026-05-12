import { useState, useEffect, useRef } from "react";

const EARN_SYSTEM = `You are an expert solution consultant. Your tone is efficient, clear, and helpful.
Core Directive: Your goal is to guide a user through the EARN framework to generate a structured summary of a prospect engagement, ready to be logged in a CRM like Salesforce. YOU NEVER USE AMERICAN ENGLISH, ALWAYS AND ONLY BRITISH ENGLISH!
Step 1: When invoked, say exactly: "I'm the EARN Comments Generator. I'll help you create a structured summary of your latest prospect engagement for Salesforce. Let's get started." Then ask Step 2.
Step 2: Ask: "What type of engagement was this? (e.g., Discovery, Demo, Tech Deep Dive, RFP) and what status does it have (Green, Amber, Red)"
Step 3: Ask each EARN component one at a time:
E: "Let's start with Recent Events. Tell me about the activity. What did we learn? Feel free to use bullet points."
A: "Next, Participating Audience (Roles) — who attended and who was missing?"
R: "What would stop them moving forward with Workday? Do we have the right engagement for success?"
N: "Finally, Next Steps. What are the follow up activities for presales & when?"
Step 4: Once all four components collected, synthesise into professional British English. Not pompous.
Step 5: Output ONLY this format — no bold, no symbols, no preamble, no thanks, no explanation:
[Date as Nth Month YYYY], RF, [Engagement Type], [Status]

Recent Events
[synthesised text]

Participating Audience (Roles)
[synthesised text]

Potential Risks
[synthesised text]

Next Steps
[synthesised text]
______________________________________`;

// ── Dynamic date helpers ──────────────────────────────────────────────
const TODAY = new Date();

const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };

const fmt = (date) => date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fmtDay = (date) => date.toLocaleDateString("en-GB", { weekday: "short" });
const fmtShort = (date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// Find the Monday of the current week
const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

const MONDAY = getMonday(TODAY);

// Board columns with real dates
const buildCols = () => {
  const mon = getMonday(TODAY);
  const isToday = (d) => d.toDateString() === TODAY.toDateString();
  const dayLabel = (d) => {
    if (isToday(d)) return "Today";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
  };
  return [
    { id: "urgent", label: "Urgent",           accent: "#ef4444", date: TODAY },
    { id: "mon",    label: dayLabel(mon),       accent: isToday(mon) ? "#f97316" : "#8b5cf6", date: mon },
    { id: "tue",    label: dayLabel(addDays(mon,1)), accent: isToday(addDays(mon,1)) ? "#f97316" : "#8b5cf6", date: addDays(mon,1) },
    { id: "wed",    label: dayLabel(addDays(mon,2)), accent: isToday(addDays(mon,2)) ? "#f97316" : "#8b5cf6", date: addDays(mon,2) },
    { id: "thu",    label: dayLabel(addDays(mon,3)), accent: isToday(addDays(mon,3)) ? "#f97316" : "#8b5cf6", date: addDays(mon,3) },
    { id: "fri",    label: dayLabel(addDays(mon,4)), accent: isToday(addDays(mon,4)) ? "#f97316" : "#8b5cf6", date: addDays(mon,4) },
    { id: "later",  label: "Later",             accent: "#3b82f6", date: null },
    { id: "done",   label: "Done",              accent: "#22c55e", date: null },
  ];
};

const BOARD_COLS = buildCols();

const OPPS = [
  { id: 1, name: "Acme Corp",   stage: "Proposal",    value: "£84,000",  owner: "Sarah K.", last: "2h ago", notes: [] },
  { id: 2, name: "Globex Ltd",  stage: "Discovery",   value: "£32,000",  owner: "Tom R.",   last: "1d ago", notes: [] },
  { id: 3, name: "Initech",     stage: "Negotiation", value: "£120,000", owner: "Sarah K.", last: "3h ago", notes: [] },
  { id: 4, name: "Umbrella Co", stage: "Closed Won",  value: "£55,000",  owner: "Tom R.",   last: "5d ago", notes: [] },
];

const STAGE_C = {
  "Discovery":   { bg: "#1a3a5c", c: "#7ab8f5" },
  "Proposal":    { bg: "#3a2e0a", c: "#f5c842" },
  "Negotiation": { bg: "#2a1a5c", c: "#a78bfa" },
  "Closed Won":  { bg: "#0a3020", c: "#4ade80" },
  "Closed Lost": { bg: "#3a1010", c: "#f87171" },
};

const CAT_C = {
  work:     { bg: "#1a2a4a", c: "#60a5fa", b: "#3b82f6" },
  urgent:   { bg: "#3a1515", c: "#f87171", b: "#ef4444" },
  home:     { bg: "#0f2a1a", c: "#4ade80", b: "#22c55e" },
  personal: { bg: "#2a1a0a", c: "#fb923c", b: "#f97316" },
  admin:    { bg: "#1e1a3a", c: "#a78bfa", b: "#8b5cf6" },
};
const DEF_CC = { bg: "#1e2030", c: "#9ca3af", b: "#4b5563" };
const catC = (c) => CAT_C[c] || DEF_CC;

const INIT_TODOS = [
  { id: 1, text: "Follow up with Acme on pricing",       col: "urgent", cat: "work",   done: false },
  { id: 2, text: "Prepare Globex discovery call agenda", col: "mon",    cat: "work",   done: false },
  { id: 3, text: "Update Salesforce pipeline",           col: "fri",    cat: "admin",  done: false },
  { id: 4, text: "Book dentist appointment",             col: "later",  cat: "home",   done: false },
  { id: 5, text: "Send Initech contract draft",          col: "done",   cat: "urgent", done: true  },
];

const CAL_SAMPLE = [
  { id: 1, offset: 0, time: "09:00", title: "Acme intro call",     type: "call"     },
  { id: 2, offset: 0, time: "14:00", title: "Team standup",        type: "internal" },
  { id: 3, offset: 1, time: "10:30", title: "Globex discovery",    type: "call"     },
  { id: 4, offset: 2, time: "11:00", title: "Initech negotiation", type: "call"     },
  { id: 5, offset: 2, time: "15:00", title: "Forecast review",     type: "internal" },
  { id: 6, offset: 3, time: "09:30", title: "QBR prep",            type: "internal" },
  { id: 7, offset: 4, time: "13:00", title: "Umbrella check-in",   type: "call"     },
];

// Build calendar events with real dates
const CAL = CAL_SAMPLE.map(e => ({
  ...e,
  date: addDays(MONDAY, e.offset),
  day: addDays(MONDAY, e.offset).toLocaleDateString("en-GB", { weekday: "short" }),
}));

const BG = "#0f1117", BG2 = "#161b27", BG3 = "#1c2133";
const BOR = "rgba(255,255,255,0.07)", BOR2 = "rgba(255,255,255,0.12)";
const ACC = "#7c6fff", ACL = "rgba(124,111,255,0.15)";
const TX = "#e2e8f0", TXS = "#8892a4", TXM = "#c4cad4";

const TAB_ITEMS = [
  { k: "dashboard", lb: "Home",  em: "🏠" },
  { k: "opps",      lb: "Opps",  em: "💼" },
  { k: "todos",     lb: "Board", em: "🗂️"  },
  { k: "calendar",  lb: "Cal",   em: "📅" },
  { k: "news",      lb: "News",  em: "📰" },
  { k: "earn",      lb: "EARN",  em: "✨" },
];

// ── BBC RSS via allorigins proxy ──────────────────────────────────────
const BBC_RSS = "https://feeds.bbci.co.uk/news/business/rss.xml";
const PROXY   = `https://corsproxy.io/?${encodeURIComponent(BBC_RSS)}`;

const fetchBBC = async () => {
  try {
    const res  = await fetch(PROXY);
    const text = await res.text();
    const parser = new DOMParser();
    const xml  = parser.parseFromString(text, "text/xml");
    const items = Array.from(xml.querySelectorAll("item")).slice(0, 6);
    return items.map(item => ({
      title:   item.querySelector("title")?.textContent || "",
      desc:    item.querySelector("description")?.textContent?.replace(/<[^>]+>/g, "") || "",
      link:    item.querySelector("link")?.textContent || "#",
      pubDate: item.querySelector("pubDate")?.textContent || "",
    }));
  } catch { return null; }
};

const summariseNews = async (articles) => {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Summarise each of these news headlines into a single plain sentence of max 15 words. Return only a JSON array of objects with keys "title" and "summary". No markdown, no preamble.\n\n${articles.map((a,i) => `${i+1}. ${a.title}: ${a.desc}`).join("\n")}`,
        }],
      }),
    });
    const data = await res.json();
    const text = data.content?.map(c => c.text || "").join("") || "[]";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch { return null; }
};

export default function App() {
  const [tab, setTab]             = useState("dashboard");
  const [opps, setOpps]           = useState(OPPS);
  const [selOpp, setSelOpp]       = useState(null);
  const [todos, setTodos]         = useState(INIT_TODOS);
  const [noteText, setNoteText]   = useState("");
  const [noteVis, setNoteVis]     = useState("me");
  const [sessCost, setSessCost]   = useState(0);
  const [reminder, setReminder]   = useState("Follow up with Acme Corp — due today");
  const [cats, setCats]           = useState(["work","urgent","home","personal","admin"]);
  const [newCat, setNewCat]       = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newTodo, setNewTodo]     = useState("");
  const [newTodoCat, setNewTodoCat] = useState("work");
  const [addingToCol, setAddingToCol] = useState(null);
  const [dragId, setDragId]       = useState(null);
  const [dragOver, setDragOver]   = useState(null);
  const [earnMsgs, setEarnMsgs]   = useState([]);
  const [earnInput, setEarnInput] = useState("");
  const [earnLoading, setEarnLoading] = useState(false);
  const [shareModal, setShareModal]     = useState(false);
  const [oppDetailOpen, setOppDetailOpen] = useState(false);
  const [showAddOpp, setShowAddOpp]     = useState(false);
  const [newOpp, setNewOpp]             = useState({ name: "", stage: "Discovery", value: "", owner: "" });
  const [calConnectMsg, setCalConnectMsg] = useState(false);
  const [news, setNews]           = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(false);
  const earnRef = useRef(null);
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    const c = localStorage.getItem("scc_cost3");
    if (c) setSessCost(parseFloat(c) || 0);
    loadNews();
  }, []);

  useEffect(() => {
    if (earnRef.current) earnRef.current.scrollTop = earnRef.current.scrollHeight;
  }, [earnMsgs]);

  const loadNews = async () => {
    setNewsLoading(true); setNewsError(false);
    const articles = await fetchBBC();
    if (!articles) { setNewsError(true); setNewsLoading(false); return; }
    const summaries = await summariseNews(articles);
    if (summaries) {
      setNews(summaries.map((s, i) => ({ ...s, link: articles[i]?.link || "#", src: "BBC" })));
    } else {
      setNews(articles.map(a => ({ title: a.title, summary: a.desc.slice(0, 100), link: a.link, src: "BBC" })));
    }
    setNewsLoading(false);
  };

  const addTok = (i, o) => {
    const cost = (i / 1e6) * 3 + (o / 1e6) * 15;
    setSessCost(p => { const n = p + cost; localStorage.setItem("scc_cost3", n.toFixed(6)); return n; });
  };

  const sendEARN = async (msg) => {
    const msgs = [...earnMsgs, { role: "user", content: msg }];
    setEarnMsgs(msgs); setEarnInput(""); setEarnLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: EARN_SYSTEM, messages: msgs }),
      });
      const data = await res.json();
      const text = data.content?.map(c => c.text || "").join("") || "Error.";
      setEarnMsgs(p => [...p, { role: "assistant", content: text }]);
      if (data.usage) addTok(data.usage.input_tokens, data.usage.output_tokens);
    } catch { setEarnMsgs(p => [...p, { role: "assistant", content: "API error — check connection." }]); }
    setEarnLoading(false);
  };

  const startEARN = (opp) => {
    setEarnMsgs([]); setTab("earn");
    setTimeout(() => sendEARN(`Initiate EARN note. Opportunity: ${opp.name}, Stage: ${opp.stage}, Value: ${opp.value}`), 50);
  };

  const moveTodo = (id, toCol) => setTodos(p => p.map(t => t.id === id ? { ...t, col: toCol, done: toCol === "done" } : t));

  const addNote = (oppId) => {
    if (!noteText.trim()) return;
    setOpps(p => p.map(o => o.id === oppId ? { ...o, notes: [...o.notes, { id: Date.now(), text: noteText, vis: noteVis, date: new Date().toLocaleDateString("en-GB") }] } : o));
    setNoteText("");
  };

  const togNoteVis = (oppId, nid, vis) =>
    setOpps(p => p.map(o => o.id === oppId ? { ...o, notes: o.notes.map(n => n.id === nid ? { ...n, vis } : n) } : o));

  const curOpp = opps.find(o => o.id === selOpp);
  const openCount = todos.filter(t => !t.done).length;
  const visC = (v) => v === "me" ? { bg: "rgba(124,111,255,0.2)", c: "#a78bfa" } : v === "ae" ? { bg: "rgba(251,146,60,0.2)", c: "#fb923c" } : { bg: "rgba(74,222,128,0.2)", c: "#4ade80" };

  const card  = { background: BG2, border: `1px solid ${BOR}`, borderRadius: 12, padding: "14px 16px" };
  const badge = (bg, c) => ({ background: bg, color: c, fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, display: "inline-block" });

  const addOpp = () => {
    if (!newOpp.name.trim()) return;
    setOpps(p => [...p, { id: Date.now(), ...newOpp, last: "Just now", notes: [] }]);
    setNewOpp({ name: "", stage: "Discovery", value: "", owner: "" });
    setShowAddOpp(false);
  };

  const todayStr = TODAY.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Calendar — group by day for display
  const calDays = BOARD_COLS.slice(1, 6).map(col => ({
    label: col.label,
    date:  col.date,
    events: CAL.filter(e => e.date.toDateString() === col.date?.toDateString()),
  }));

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: TX, paddingBottom: isMobile ? 64 : 0 }}>
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        input, textarea, select {
          background: ${BG3} !important; color: ${TX} !important;
          border: 1px solid ${BOR2} !important; border-radius: 8px !important;
          padding: 8px 10px !important; font-size: 14px !important;
          font-family: system-ui, sans-serif !important; outline: none; width: 100%;
        }
        input:focus, textarea:focus, select:focus { border-color: ${ACC} !important; }
        select option { background: ${BG2}; }
        button { font-family: system-ui, sans-serif; }
      `}</style>

      {reminder && (
        <div style={{ background: "rgba(251,146,60,0.1)", borderBottom: "1px solid rgba(251,146,60,0.2)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#fb923c", flex: 1 }}>🔔 {reminder}</span>
          <button onClick={() => setReminder(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#fb923c", fontSize: 20, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        </div>
      )}

      <div style={{ background: BG2, borderBottom: `1px solid ${BOR}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: ACL, border: `1px solid ${ACC}`, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🚀</div>
          <span style={{ fontWeight: 500, fontSize: 14, color: TX }}>Command Centre</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: BG3, border: `1px solid ${BOR}`, borderRadius: 8, padding: "4px 10px", fontSize: 12, color: TXS, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: ACC }}>⬡</span>
            <span style={{ color: TX, fontWeight: 500 }}>${sessCost.toFixed(4)}</span>
            <div style={{ width: 32, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
              <div style={{ width: `${Math.min((sessCost / 70) * 100, 100)}%`, height: "100%", background: sessCost / 70 > 0.8 ? "#ef4444" : ACC, borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#7c6fff,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#fff" }}>R</div>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 52px)" }}>
        {!isMobile && (
          <nav style={{ width: 200, background: BG2, borderRight: `1px solid ${BOR}`, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, position: "sticky", top: 52, height: "calc(100vh - 52px)", overflowY: "auto", flexShrink: 0 }}>
            {TAB_ITEMS.map(({ k, em, lb }) => (
              <button key={k} onClick={() => setTab(k)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "none", background: tab === k ? ACL : "transparent", color: tab === k ? ACC : TXS, cursor: "pointer", fontSize: 13, fontWeight: tab === k ? 500 : 400, width: "100%", textAlign: "left" }}>
                <span>{em}</span>{lb}
              </button>
            ))}
            <div style={{ marginTop: "auto", padding: "12px", background: BG3, borderRadius: 8, border: `1px solid ${BOR}` }}>
              <div style={{ fontSize: 11, color: TXS, marginBottom: 4 }}>14°C London</div>
              <div style={{ fontSize: 11, color: TXS }}>{todayStr}</div>
            </div>
          </nav>
        )}

        <main style={{ flex: 1, padding: isMobile ? 12 : 24, minWidth: 0, overflowX: "hidden" }}>

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 500, color: TX }}>Good morning</div>
                <div style={{ fontSize: 13, color: TXS, marginTop: 2 }}>{openCount} open tasks · {todayStr}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div style={card}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: TXS, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Opportunities</div>
                  {opps.map(o => (
                    <div key={o.id} onClick={() => { setSelOpp(o.id); setTab("opps"); setOppDetailOpen(true); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${BOR}`, cursor: "pointer", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: TX, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                        <div style={{ fontSize: 11, color: TXS }}>{o.value}</div>
                      </div>
                      <span style={badge(STAGE_C[o.stage]?.bg, STAGE_C[o.stage]?.c)}>{o.stage}</span>
                    </div>
                  ))}
                </div>

                <div style={card}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: TXS, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Open tasks</div>
                  {todos.filter(t => !t.done).slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${BOR}` }}>
                      <input type="checkbox" onChange={() => moveTodo(t.id, "done")} style={{ flexShrink: 0, accentColor: ACC, width: 15, height: 15 }} />
                      <span style={{ fontSize: 13, flex: 1, color: TXM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</span>
                      <span style={{ ...badge(catC(t.cat).bg, catC(t.cat).c), borderRadius: 10, flexShrink: 0 }}>{t.cat}</span>
                    </div>
                  ))}
                </div>

                <div style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: TXS, textTransform: "uppercase", letterSpacing: "0.06em" }}>This week</span>
                    <span style={{ fontSize: 11, color: TXS, background: BG3, padding: "2px 7px", borderRadius: 5, border: `1px solid ${BOR}` }}>Connect calendar</span>
                  </div>
                  {CAL.slice(0, 4).map(e => (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${BOR}` }}>
                      <span style={{ fontSize: 11, color: TXS, minWidth: 30 }}>{fmtDay(e.date)}</span>
                      <span style={{ fontSize: 11, color: TXS, minWidth: 34 }}>{e.time}</span>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: e.type === "call" ? ACC : "#4ade80", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: TXM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                    </div>
                  ))}
                </div>

                <div style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: TXS, textTransform: "uppercase", letterSpacing: "0.06em" }}>BBC News</span>
                    <button onClick={loadNews} style={{ fontSize: 11, color: TXS, background: BG3, padding: "2px 7px", borderRadius: 5, border: `1px solid ${BOR}`, cursor: "pointer" }}>↺ Refresh</button>
                  </div>
                  {newsLoading && <div style={{ fontSize: 13, color: TXS }}>Loading news…</div>}
                  {newsError && <div style={{ fontSize: 13, color: "#f87171" }}>Could not load news. Check connection.</div>}
                  {!newsLoading && !newsError && news.slice(0, 3).map((n, i) => (
                    <a key={i} href={n.link} target="_blank" rel="noreferrer" style={{ display: "block", padding: "7px 0", borderBottom: `1px solid ${BOR}`, textDecoration: "none" }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: TXM, marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: TXS }}>{n.summary}</div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* OPPORTUNITIES */}
          {tab === "opps" && (
            <div>
              {(!oppDetailOpen || !isMobile) && (
                <div style={isMobile ? {} : { display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: TX }}>Opportunities</div>
                      <button onClick={() => setShowAddOpp(true)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, background: ACC, color: "#fff", border: "none", cursor: "pointer", fontWeight: 500 }}>+ Add opp</button>
                    </div>
                    {showAddOpp && (
                      <div style={{ ...card, marginBottom: 12, background: BG3 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: TXM, marginBottom: 10 }}>New opportunity</div>
                        <input value={newOpp.name} onChange={e => setNewOpp(p => ({ ...p, name: e.target.value }))} placeholder="Company name" style={{ marginBottom: 8 }} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <input value={newOpp.value} onChange={e => setNewOpp(p => ({ ...p, value: e.target.value }))} placeholder="Value e.g. £50,000" />
                          <input value={newOpp.owner} onChange={e => setNewOpp(p => ({ ...p, owner: e.target.value }))} placeholder="AE name" />
                        </div>
                        <select value={newOpp.stage} onChange={e => setNewOpp(p => ({ ...p, stage: e.target.value }))} style={{ marginBottom: 10 }}>
                          {Object.keys(STAGE_C).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={addOpp} style={{ flex: 1, padding: "8px", borderRadius: 8, background: ACC, color: "#fff", border: "none", cursor: "pointer", fontWeight: 500, fontSize: 13 }}>Save</button>
                          <button onClick={() => setShowAddOpp(false)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${BOR2}`, background: "transparent", color: TXS, cursor: "pointer", fontSize: 13 }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {opps.map(o => (
                      <div key={o.id} onClick={() => { setSelOpp(o.id); setOppDetailOpen(true); }} style={{ ...card, marginBottom: 8, cursor: "pointer", border: selOpp === o.id ? `1px solid ${ACC}` : `1px solid ${BOR}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: TX }}>{o.name}</div>
                            <div style={{ fontSize: 12, color: TXS, marginTop: 2 }}>{o.value} · {o.owner}</div>
                          </div>
                          <span style={badge(STAGE_C[o.stage]?.bg, STAGE_C[o.stage]?.c)}>{o.stage}</span>
                        </div>
                        <div style={{ fontSize: 11, color: TXS, marginTop: 6, display: "flex", gap: 12 }}>
                          <span>🕐 {o.last}</span>
                          <span>📝 {o.notes.length} notes</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selOpp && curOpp && !isMobile && (
                    <div style={card}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 500, color: TX }}>{curOpp.name}</div>
                          <div style={{ fontSize: 12, color: TXS, marginTop: 2 }}>{curOpp.value} · {curOpp.owner}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={() => startEARN(curOpp)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: `1px solid ${ACC}`, cursor: "pointer", background: ACL, color: "#a78bfa", fontWeight: 500 }}>✨ EARN note</button>
                          <button onClick={() => setShareModal(true)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: `1px solid ${BOR2}`, cursor: "pointer", background: BG3, color: TXS }}>Share</button>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: TXM, marginBottom: 8 }}>Notes</div>
                      {curOpp.notes.length === 0 && <div style={{ fontSize: 13, color: TXS, marginBottom: 10 }}>No notes yet.</div>}
                      {curOpp.notes.map(n => (
                        <div key={n.id} style={{ background: BG3, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: TXS }}>{n.date}</span>
                            <select value={n.vis} onChange={e => togNoteVis(curOpp.id, n.id, e.target.value)} style={{ fontSize: "11px !important", padding: "2px 6px !important", width: "auto !important", background: `${visC(n.vis).bg} !important`, color: `${visC(n.vis).c} !important`, border: "none !important", borderRadius: "4px !important", cursor: "pointer" }}>
                              <option value="me">Only me</option>
                              <option value="ae">Me + AE</option>
                              <option value="manager">All</option>
                            </select>
                          </div>
                          <div style={{ fontSize: 13, color: TXM, lineHeight: 1.5 }}>{n.text}</div>
                        </div>
                      ))}
                      <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note…" style={{ height: 72, resize: "none", marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <select value={noteVis} onChange={e => setNoteVis(e.target.value)} style={{ flex: 1, background: `${visC(noteVis).bg} !important`, color: `${visC(noteVis).c} !important` }}>
                          <option value="me">Only me</option>
                          <option value="ae">Me + AE</option>
                          <option value="manager">All</option>
                        </select>
                        <button onClick={() => addNote(curOpp.id)} style={{ padding: "8px 18px", borderRadius: 8, background: ACC, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>Save</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {oppDetailOpen && curOpp && isMobile && (
                <div style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <button onClick={() => setOppDetailOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: TXS, padding: 0, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>←</button>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: TX }}>{curOpp.name}</div>
                      <div style={{ fontSize: 12, color: TXS }}>{curOpp.value} · {curOpp.owner}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    <span style={badge(STAGE_C[curOpp.stage]?.bg, STAGE_C[curOpp.stage]?.c)}>{curOpp.stage}</span>
                    <button onClick={() => startEARN(curOpp)} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: `1px solid ${ACC}`, cursor: "pointer", background: ACL, color: "#a78bfa", fontWeight: 500 }}>✨ EARN</button>
                    <button onClick={() => setShareModal(true)} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: `1px solid ${BOR2}`, cursor: "pointer", background: BG3, color: TXS }}>Share</button>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: TXM, marginBottom: 8 }}>Notes</div>
                  {curOpp.notes.length === 0 && <div style={{ fontSize: 13, color: TXS, marginBottom: 10 }}>No notes yet.</div>}
                  {curOpp.notes.map(n => (
                    <div key={n.id} style={{ background: BG3, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: TXS, marginBottom: 4 }}>{n.date}</div>
                      <div style={{ fontSize: 13, color: TXM, lineHeight: 1.5 }}>{n.text}</div>
                    </div>
                  ))}
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note…" style={{ height: 72, resize: "none", marginBottom: 8 }} />
                  <button onClick={() => addNote(curOpp.id)} style={{ width: "100%", padding: "10px", borderRadius: 8, background: ACC, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Save note</button>
                </div>
              )}
            </div>
          )}

          {/* BOARD */}
          {tab === "todos" && (
            <div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                {cats.map(c => (
                  <span key={c} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: catC(c).bg, color: catC(c).c, border: `1px solid ${catC(c).b}` }}>{c}</span>
                ))}
                {showNewCat ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newCat.trim()) { setCats(p => [...p, newCat.trim().toLowerCase()]); setNewCat(""); setShowNewCat(false); } }} placeholder="Name…" style={{ width: "100px !important", padding: "3px 8px !important", fontSize: "12px !important", height: 28 }} />
                    <button onClick={() => { if (newCat.trim()) setCats(p => [...p, newCat.trim().toLowerCase()]); setNewCat(""); setShowNewCat(false); }} style={{ padding: "3px 8px", borderRadius: 6, background: ACC, color: "#fff", border: "none", cursor: "pointer", fontSize: 12, height: 28 }}>+</button>
                  </div>
                ) : (
                  <button onClick={() => setShowNewCat(true)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: `1px dashed ${BOR2}`, background: "transparent", cursor: "pointer", color: TXS }}>+ Add</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12, alignItems: "flex-start" }}>
                {BOARD_COLS.map(col => {
                  const colItems = todos.filter(t => t.col === col.id);
                  return (
                    <div key={col.id} style={{ minWidth: 155, maxWidth: 155, flexShrink: 0 }}
                      onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
                      onDrop={e => { e.preventDefault(); if (dragId) moveTodo(dragId, col.id); setDragId(null); setDragOver(null); }}>
                      <div style={{ background: dragOver === col.id ? `${col.accent}18` : BG3, border: `1px solid ${dragOver === col.id ? col.accent : BOR}`, borderRadius: 10, padding: "10px 8px", minHeight: 100, transition: "border-color .15s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: col.accent }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: TXM }}>{col.label}</span>
                          <span style={{ marginLeft: "auto", fontSize: 10, color: TXS, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "1px 5px" }}>{colItems.length}</span>
                        </div>
                        {col.date && (
                          <div style={{ fontSize: 10, color: TXS, marginBottom: 8 }}>{fmtShort(col.date)}</div>
                        )}
                        {colItems.map(t => (
                          <div key={t.id} draggable onDragStart={() => setDragId(t.id)}
                            style={{ background: BG2, border: `1px solid ${BOR}`, borderRadius: 7, padding: "7px 8px", marginBottom: 5, cursor: "grab", opacity: t.done ? 0.5 : 1, userSelect: "none" }}>
                            <div style={{ fontSize: 12, color: t.done ? TXS : TXM, textDecoration: t.done ? "line-through" : "none", lineHeight: 1.4, marginBottom: 4 }}>{t.text}</div>
                            <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 8, background: catC(t.cat).bg, color: catC(t.cat).c }}>{t.cat}</span>
                          </div>
                        ))}
                        {addingToCol === col.id ? (
                          <div>
                            <input value={newTodo} onChange={e => setNewTodo(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && newTodo.trim()) { setTodos(p => [...p, { id: Date.now(), text: newTodo, col: col.id, cat: newTodoCat, done: col.id === "done" }]); setNewTodo(""); setAddingToCol(null); } if (e.key === "Escape") setAddingToCol(null); }}
                              placeholder="Task…" autoFocus style={{ marginBottom: "4px !important", fontSize: "12px !important", padding: "5px 7px !important" }} />
                            <select value={newTodoCat} onChange={e => setNewTodoCat(e.target.value)} style={{ marginBottom: "4px !important", fontSize: "11px !important", padding: "3px 6px !important" }}>
                              {cats.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => { if (newTodo.trim()) { setTodos(p => [...p, { id: Date.now(), text: newTodo, col: col.id, cat: newTodoCat, done: col.id === "done" }]); setNewTodo(""); setAddingToCol(null); } }} style={{ flex: 1, fontSize: 11, padding: "4px", borderRadius: 5, background: ACC, color: "#fff", border: "none", cursor: "pointer" }}>Add</button>
                              <button onClick={() => { setNewTodo(""); setAddingToCol(null); }} style={{ fontSize: 11, padding: "4px 6px", borderRadius: 5, background: "transparent", border: `1px solid ${BOR2}`, color: TXS, cursor: "pointer" }}>✕</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setAddingToCol(col.id)} style={{ width: "100%", fontSize: 11, padding: "4px", borderRadius: 6, background: "transparent", border: `1px dashed ${BOR2}`, color: TXS, cursor: "pointer", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
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

          {/* CALENDAR */}
          {tab === "calendar" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: TX }}>Week of {fmtShort(MONDAY)}</div>
                <button onClick={() => setCalConnectMsg(p => !p)} style={{ fontSize: 11, color: TXS, background: BG3, padding: "4px 8px", borderRadius: 6, border: `1px solid ${BOR}`, cursor: "pointer" }}>
                  🔗 Connect Outlook / Google
                </button>
              </div>
              {calConnectMsg && (
                <div style={{ ...card, marginBottom: 12, background: "rgba(124,111,255,0.08)", border: `1px solid ${ACC}` }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: ACC, marginBottom: 6 }}>Connecting your calendar</div>
                  <div style={{ fontSize: 12, color: TXM, lineHeight: 1.6 }}>
                    Calendar sync requires an OAuth connection to Microsoft or Google. We'll set this up properly in a dedicated step after Supabase — it needs a small backend function and app registration.<br/><br/>
                    <strong style={{ color: TXM }}>For Outlook:</strong> Register an app at portal.azure.com → Microsoft Graph API → Calendars.Read scope.<br/>
                    <strong style={{ color: TXM }}>For Google:</strong> Create a project at console.cloud.google.com → Google Calendar API → OAuth 2.0.
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {calDays.map(({ label, date, events }) => (
                  <div key={label} style={{ ...card, border: date.toDateString() === TODAY.toDateString() ? `1px solid ${ACC}` : `1px solid ${BOR}` }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: date.toDateString() === TODAY.toDateString() ? ACC : TXS, marginBottom: events.length ? 8 : 0, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
                      <span style={{ fontWeight: 400 }}>{fmtShort(date)}</span>
                    </div>
                    {events.length === 0 && <div style={{ fontSize: 12, color: TXS }}>No events</div>}
                    {events.map(e => (
                      <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${BOR}` }}>
                        <span style={{ fontSize: 12, color: TXS, minWidth: 40 }}>{e.time}</span>
                        <span style={{ width: 3, height: 24, borderRadius: 2, background: e.type === "call" ? ACC : "#4ade80", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: TXM }}>{e.title}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NEWS */}
          {tab === "news" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: TX }}>News digest</div>
                <button onClick={loadNews} style={{ fontSize: 11, color: TXS, background: BG3, padding: "4px 8px", borderRadius: 6, border: `1px solid ${BOR}`, cursor: "pointer" }}>↺ Refresh</button>
              </div>
              <div style={{ ...card, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: TXM, marginBottom: 2 }}>Company intranet</div>
                  <div style={{ fontSize: 11, color: TXS }}>Paste your intranet RSS URL to connect</div>
                </div>
                <span style={{ fontSize: 11, color: TXS, background: BG3, padding: "4px 8px", borderRadius: 6, border: `1px solid ${BOR}` }}>Not connected</span>
              </div>
              {newsLoading && <div style={{ fontSize: 13, color: TXS, padding: "20px 0", textAlign: "center" }}>Loading BBC News…</div>}
              {newsError && <div style={{ fontSize: 13, color: "#f87171", padding: "20px 0", textAlign: "center" }}>Could not load news. Check connection and refresh.</div>}
              {!newsLoading && !newsError && news.map((n, i) => (
                <a key={i} href={n.link} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none" }}>
                  <div style={{ ...card, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}>
                      <span style={badge("rgba(248,113,113,0.15)", "#f87171")}>BBC</span>
                    </div>
                    <div style={{ fontWeight: 500, fontSize: 13, color: TXM, marginBottom: 3 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: TXS, lineHeight: 1.5 }}>{n.summary}</div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* EARN */}
          {tab === "earn" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: TX, marginBottom: 4 }}>EARN note generator</div>
              <div style={{ fontSize: 12, color: TXS, marginBottom: 14 }}>AI-powered · British English · Salesforce-ready</div>
              {earnMsgs.length === 0 ? (
                <div style={{ ...card, textAlign: "center", padding: "32px 16px" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>✨</div>
                  <div style={{ fontSize: 14, color: TXM, marginBottom: 14 }}>Start from an opportunity or begin fresh</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    {opps.map(o => (
                      <button key={o.id} onClick={() => startEARN(o)} style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, border: `1px solid ${BOR2}`, background: BG3, color: TXM, cursor: "pointer" }}>{o.name}</button>
                    ))}
                    <button onClick={() => sendEARN("Start")} style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, border: `1px solid ${ACC}`, background: ACL, color: "#a78bfa", cursor: "pointer", fontWeight: 500 }}>+ Fresh start</button>
                  </div>
                </div>
              ) : (
                <div style={card}>
                  <div ref={earnRef} style={{ maxHeight: 400, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {earnMsgs.map((m, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "85%", background: m.role === "user" ? ACL : BG3, border: `1px solid ${m.role === "user" ? ACC : BOR}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: TXM, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {earnLoading && (
                      <div style={{ display: "flex" }}>
                        <div style={{ background: BG3, border: `1px solid ${BOR}`, borderRadius: 10, padding: "9px 14px", fontSize: 13, color: TXS }}>Thinking…</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={earnInput} onChange={e => setEarnInput(e.target.value)} onKeyDown={e => e.key === "Enter" && earnInput.trim() && sendEARN(earnInput)} placeholder="Your response…" />
                    <button onClick={() => earnInput.trim() && sendEARN(earnInput)} style={{ padding: "8px 14px", borderRadius: 8, background: ACC, color: "#fff", border: "none", cursor: "pointer", fontWeight: 500, flexShrink: 0 }}>Send</button>
                    <button onClick={() => setEarnMsgs([])} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${BOR2}`, background: "transparent", color: TXS, cursor: "pointer", flexShrink: 0 }}>↺</button>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {isMobile && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: BG2, borderTop: `1px solid ${BOR}`, display: "flex", zIndex: 50, height: 56 }}>
          {TAB_ITEMS.map(({ k, lb, em }) => (
            <button key={k} onClick={() => { setTab(k); setOppDetailOpen(false); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, border: "none", background: "none", cursor: "pointer", color: tab === k ? ACC : TXS, padding: "6px 0" }}>
              <span style={{ fontSize: 18 }}>{em}</span>
              <span style={{ fontSize: 10, fontWeight: tab === k ? 500 : 400 }}>{lb}</span>
            </button>
          ))}
        </nav>
      )}

      {shareModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 999, padding: isMobile ? "0 0 64px" : 0 }} onClick={() => setShareModal(false)}>
          <div style={{ ...card, width: "100%", maxWidth: 400, borderRadius: isMobile ? "12px 12px 0 0" : 12 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 500, fontSize: 15, color: TX, marginBottom: 14 }}>Share notes</div>
            <input placeholder="Colleague's email…" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 12, color: TXS, marginBottom: 12 }}>Connect Slack or email for automatic sending</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShareModal(false)} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: `1px solid ${BOR2}`, background: "transparent", color: TXS, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => setShareModal(false)} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, background: ACC, color: "#fff", border: "none", cursor: "pointer" }}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}