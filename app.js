/* TradeTrack - Supabase-powered frontend
   Replace the two CONFIG values with your Supabase project's publishable values.
   NEVER put a Supabase secret/service_role key here. */
const CONFIG = {
  supabaseUrl: "https://nxjkyoizshjpbvpmmavd.supabase.co",
  supabasePublishableKey: "sb_publishable_gS1WTzXGxhqSA_Nj0hkzIA_CdEQmRzM"
};

const supabaseReady = CONFIG.supabaseUrl.startsWith("https://") && !CONFIG.supabasePublishableKey.startsWith("YOUR_");
const supabaseClient = supabaseReady ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey) : null;

let user = null;
let profile = null;
let trades = [];
let friendships = [];
let profiles = [];
let chart;
let selectedDate = null;
let viewDate = new Date();
let period = "month";

const $ = (s) => document.querySelector(s);
const money = (n) => `${n < 0 ? "-" : ""}$${Math.abs(Number(n)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parseKey = (k) => { const [y,m,d] = k.split("-").map(Number); return new Date(y,m-1,d); };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function groupedTrades(){
  const out={};
  trades.forEach(t=>{ (out[t.trade_date] ||= []).push(t); });
  return out;
}
function stats(list=trades){
  const wins=list.filter(t=>Number(t.pnl)>0), losses=list.filter(t=>Number(t.pnl)<0);
  const total=list.reduce((s,t)=>s+Number(t.pnl),0), gp=wins.reduce((s,t)=>s+Number(t.pnl),0), gl=Math.abs(losses.reduce((s,t)=>s+Number(t.pnl),0));
  return {ts:list,wins,losses,total,gp,gl,winRate:list.length?wins.length/list.length*100:0,pf:gl?gp/gl:gp?Infinity:0};
}

function showAuth(show=true){ $("#authBackdrop").classList.toggle("show",show); $(".app-shell").classList.toggle("locked",show); }
function authMessage(msg, error=false){ $("#authMessage").textContent=msg; $("#authMessage").className=`form-message ${error?"error":""}`; }
function setAuthMode(mode){
  $("#authMode").textContent=mode==="signup"?"Create your account":"Welcome back";
  $("#authSubmit").textContent=mode==="signup"?"Create account":"Sign in";
  $("#authUsernameWrap").style.display=mode==="signup"?"block":"none";
  $("#authForm").dataset.mode=mode;
  authMessage("");
}

async function start(){
  if(!supabaseReady){ showAuth(true); authMessage("Connect your Supabase URL and publishable key in app.js before using the site.",true); return; }
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(session) await loadUser(session.user); else showAuth(true);
  supabaseClient.auth.onAuthStateChange(async (_event,session)=>{ if(session) await loadUser(session.user); else {user=null;profile=null;trades=[];friendships=[];showAuth(true);} });
}

async function loadUser(u){
  user=u;
  const {data:p,error:pe}=await supabaseClient.from("profiles").select("*").eq("id",u.id).single();
  if(pe){ console.error(pe); authMessage(pe.message,true); return; }
  profile=p;
  showAuth(false);
  await Promise.all([loadTrades(),loadFriends()]);
  renderAll();
}
async function loadTrades(){
  const {data,error}=await supabaseClient.from("trades").select("id,user_id,trade_date,pnl,reason,created_at").order("trade_date",{ascending:false}).order("created_at",{ascending:false});
  if(error){console.error(error);return;} trades=data||[];
}
async function loadFriends(){
  const {data,error}=await supabaseClient.from("friendships").select("*").order("created_at",{ascending:false});
  if(error){console.error(error);return;} friendships=data||[];
  const ids=[...new Set(friendships.flatMap(f=>[f.requester_id,f.addressee_id]))];
  if(ids.length){const r=await supabaseClient.from("profiles").select("id,username,share_performance").in("id",ids);profiles=r.data||[];}
}
function profileById(id){return profiles.find(p=>p.id===id);}
function currentFriendIds(){return friendships.filter(f=>f.status==="accepted").map(f=>f.requester_id===user.id?f.addressee_id:f.requester_id);}
function ownTrades(){return trades.filter(t=>t.user_id===user.id);}

function renderSummary(){
  const s=stats(ownTrades());
  $("#totalPL").textContent=money(s.total); $("#totalPL").className=s.total>=0?"positive":"negative";
  $("#winRate").textContent=`${s.winRate.toFixed(1)}%`; $("#winRateSub").textContent=`${s.wins.length} wins / ${s.ts.length} trades`; $("#totalTrades").textContent=s.ts.length;
  const byDate=groupedOwn(); let best=null; Object.entries(byDate).forEach(([d,a])=>{const v=a.reduce((x,t)=>x+Number(t.pnl),0);if(!best||v>best.v)best={d,v};});
  $("#bestDay").textContent=best?money(best.v):"$0.00"; $("#bestDayDate").textContent=best?parseKey(best.d).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"No trades yet";
}
function groupedOwn(){const o={};ownTrades().forEach(t=>(o[t.trade_date]??=[]).push(t));return o;}
function dayHtml(d,muted=false){const k=dateKey(d),arr=groupedOwn()[k]||[],pl=arr.reduce((s,t)=>s+Number(t.pnl),0),cls=pl>0?"profit":pl<0?"loss":"";return `<button class="day ${cls} ${muted?"muted":""} ${k===dateKey(new Date())?"today":""}" data-date="${k}"><span class="num">${d.getDate()}</span>${arr.length?`<div class="trade-count">${arr.length} trade${arr.length>1?"s":""}</div><div class="day-pl">${money(pl)}</div>`:""}</button>`}
function renderCalendar(){
  const view=new Date(viewDate),box=$("#calendarView");
  if(period==="day"){ $("#calendarLabel").textContent=view.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"}); box.innerHTML=renderDay(view); return; }
  if(period==="all"){ $("#calendarLabel").textContent="All time"; box.innerHTML=renderAllYears(); return; }
  if(period==="year"){ $("#calendarLabel").textContent=view.getFullYear(); box.innerHTML=renderYear(view.getFullYear()); return; }
  if(period==="week"){ const start=new Date(view); start.setDate(start.getDate()-start.getDay()); $("#calendarLabel").textContent=`${start.toLocaleDateString(undefined,{month:"short",day:"numeric"})} – ${new Date(start.getFullYear(),start.getMonth(),start.getDate()+6).toLocaleDateString(undefined,{month:"short",day:"numeric"})}`; box.innerHTML=renderWeek(start); return; }
  $("#calendarLabel").textContent=view.toLocaleDateString(undefined,{month:"long",year:"numeric"}); box.innerHTML=renderMonth(view);
}
function renderMonth(v){let first=new Date(v.getFullYear(),v.getMonth(),1),start=new Date(first);start.setDate(1-first.getDay());let html='<div class="calendar-grid">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>`<div class="weekday">${x}</div>`).join("");for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);html+=dayHtml(d,d.getMonth()!==v.getMonth());}return html+"</div>";}
function renderWeek(start){let html='<div class="calendar-grid">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>`<div class="weekday">${x}</div>`).join("");for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);html+=dayHtml(d);}return html+"</div>";}
function renderDay(d){const k=dateKey(d),arr=groupedOwn()[k]||[];return `<div class="calendar-grid">${dayHtml(d)}</div><div class="day-detail card" style="margin-top:12px;padding:16px"><div class="section-head"><div><p class="eyebrow">TRADES</p><h3>${d.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</h3></div><button class="primary" data-add="${k}">+ Add trade</button></div>${arr.map(t=>`<div class="friend-row"><div><b>${money(Number(t.pnl))}</b><small>${escapeHtml(t.reason)}</small></div><button class="small-btn" data-delete="${t.id}">Delete</button></div>`).join("")||'<div class="empty">No trades recorded for this day.</div>'}</div>`;}
function renderYear(y){let html='<div class="months-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">';for(let m=0;m<12;m++){const total=ownTrades().filter(t=>parseKey(t.trade_date).getFullYear()===y&&parseKey(t.trade_date).getMonth()===m).reduce((s,t)=>s+Number(t.pnl),0);html+=`<button class="card" data-month="${m}" style="padding:14px;text-align:left;color:#dce3f3;border:1px solid #222c40"><b>${new Date(y,m,1).toLocaleDateString(undefined,{month:"long"})}</b><div style="margin-top:10px" class="${total>=0?"positive":"negative"}">${money(total)}</div></button>`;}return html+"</div>";}
function renderAllYears(){const years=[...new Set(ownTrades().map(t=>parseKey(t.trade_date).getFullYear()))].sort((a,b)=>b-a);if(!years.length)return '<div class="empty">No trades yet. Add a trade from the calendar to start tracking.</div>';return `<div class="card" style="padding:18px"><div class="table-wrap"><table><thead><tr><th>Year</th><th>Trades</th><th>P/L</th></tr></thead><tbody>${years.map(y=>{const ts=ownTrades().filter(t=>parseKey(t.trade_date).getFullYear()===y),pl=ts.reduce((s,t)=>s+Number(t.pnl),0);return `<tr><td>${y}</td><td>${ts.length}</td><td class="${pl>=0?"positive":"negative"}">${money(pl)}</td></tr>`}).join("")}</tbody></table></div></div>`;}

function series(){const grouped=groupedOwn(),keys=Object.keys(grouped).sort(),out=[];let cum=0;for(const k of keys){const pl=grouped[k].reduce((s,t)=>s+Number(t.pnl),0);cum+=pl;out.push({k,cum,pl,trades:grouped[k].length});}return out;}
function drawChart(){const m=$("#chartMetric").value,rows=series(),labels=rows.map(x=>parseKey(x.k).toLocaleDateString(undefined,{month:"short",day:"numeric"})),data=m==="pl"?rows.map(x=>x.cum):m==="trades"?rows.map((_,i)=>rows.slice(0,i+1).reduce((s,x)=>s+x.trades,0)):rows.map((_,i)=>{const ts=ownTrades().filter(t=>t.trade_date<=rows[i].k);return ts.length?ts.filter(t=>Number(t.pnl)>0).length/ts.length*100:0;});if(chart)chart.destroy();chart=new Chart($("#performanceChart"),{type:"line",data:{labels,datasets:[{label:m==="pl"?"Cumulative P/L":m==="trades"?"Total trades":"Win rate %",data,borderWidth:2,tension:.35,pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#a8b2c7"}}},scales:{x:{ticks:{color:"#68738b"},grid:{color:"rgba(255,255,255,.03)"}},y:{ticks:{color:"#68738b"},grid:{color:"rgba(255,255,255,.05)"}}}}});}
function renderAnalytics(){const s=stats(ownTrades());$("#avgTrade").textContent=s.ts.length?money(s.total/s.ts.length):"$0.00";$("#wins").textContent=s.wins.length;$("#losses").textContent=s.losses.length;$("#winsPct").textContent=`${s.winRate.toFixed(1)}% of trades`;$("#lossesPct").textContent=`${s.ts.length?(s.losses.length/s.ts.length*100).toFixed(1):0}% of trades`;$("#profitFactor").textContent=s.pf===Infinity?"∞":s.pf.toFixed(2);$("#tradeTable").innerHTML=s.ts.slice(0,12).map(t=>`<tr><td>${parseKey(t.trade_date).toLocaleDateString()}</td><td>${escapeHtml(t.reason)}</td><td class="${Number(t.pnl)>=0?"positive":"negative"}">${money(Number(t.pnl))}</td></tr>`).join("")||'<tr><td colspan="3" class="empty">No trades yet.</td></tr>';drawChart();}

async function renderFriends(){
  const incoming=friendships.filter(f=>f.addressee_id===user.id&&f.status==="pending");
  const accepted=friendships.filter(f=>f.status==="accepted");
  const myPending=friendships.filter(f=>f.requester_id===user.id&&f.status==="pending");
  $("#myUsername").textContent=profile.username;$("#sideUsername").textContent=profile.username;$("#sideHandle").textContent="@"+profile.username;$("#avatar").textContent=profile.username[0]?.toUpperCase()||"T";$("#friendAvatar").textContent=profile.username[0]?.toUpperCase()||"T";$("#shareToggle").checked=profile.share_performance;
  const rows=[];
  incoming.forEach(f=>{const p=profileById(f.requester_id);rows.push(`<div class="friend-row"><div class="friend-info"><div class="avatar">${(p?.username||"?")[0].toUpperCase()}</div><div><b>${escapeHtml(p?.username||"Unknown")}</b><small>Incoming request</small></div></div><div class="friend-actions"><button class="small-btn accept" data-accept="${f.id}">Accept</button><button class="small-btn decline" data-decline="${f.id}">Decline</button></div></div>`);});
  myPending.forEach(f=>{const p=profileById(f.addressee_id);rows.push(`<div class="friend-row"><div class="friend-info"><div class="avatar">${(p?.username||"?")[0].toUpperCase()}</div><div><b>${escapeHtml(p?.username||"Unknown")}</b><small>Request pending</small></div></div><span class="friend-status">Pending</span></div>`);});
  accepted.forEach(f=>{const other=f.requester_id===user.id?f.addressee_id:f.requester_id,p=profileById(other);rows.push(`<div class="friend-row"><div class="friend-info"><div class="avatar">${(p?.username||"?")[0].toUpperCase()}</div><div><b>${escapeHtml(p?.username||"Unknown")}</b><small>Friend • performance ${p?.share_performance?"shared":"hidden"}</small></div></div><button class="small-btn" data-performance="${other}">View performance</button></div>`);});
  $("#friendsList").innerHTML=rows.join("")||'<div class="empty">No friends or requests yet. Add someone by username to get started.</div>';
}

function showFriendPerformance(friendId){
  const p=profileById(friendId), list=trades.filter(t=>t.user_id===friendId);if(!p)return;
  if(!p.share_performance){alert("This friend has chosen not to share performance.");return;}
  const s=stats(list);$("#performanceTitle").textContent=`@${p.username}`;$("#friendPL").textContent=money(s.total);$("#friendWR").textContent=`${s.winRate.toFixed(1)}%`;$("#friendTrades").textContent=s.ts.length;$("#performanceModal").classList.add("show");
}

async function saveTrade(){const pnl=Number($("#plInput").value),reason=$("#reasonInput").value.trim();if(!Number.isFinite(pnl)||!reason)return;const {error}=await supabaseClient.from("trades").insert({user_id:user.id,trade_date:selectedDate,pnl,reason});if(error){alert(error.message);return;}$("#tradeModal").classList.remove("show");await loadTrades();renderAll();}
async function deleteTrade(id){if(!confirm("Delete this trade?"))return;const {error}=await supabaseClient.from("trades").delete().eq("id",id);if(error){alert(error.message);return;}await loadTrades();renderAll();}

function setTab(tab){document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));$("#"+tab+"Tab").classList.add("active");$("#pageTitle").textContent=tab[0].toUpperCase()+tab.slice(1);if(tab==="analytics")renderAnalytics();if(tab==="friends")renderFriends();}
function renderAll(){renderSummary();renderCalendar();renderAnalytics();renderFriends();}

$("#authForm").onsubmit=async e=>{e.preventDefault();if(!supabaseReady)return;const mode=e.currentTarget.dataset.mode,email=$("#authEmail").value.trim(),password=$("#authPassword").value,username=$("#authUsername").value.trim().replace(/^@/,"");$("#authSubmit").disabled=true;authMessage("Working...");let result;if(mode==="signup"){if(!/^[A-Za-z0-9_]{3,24}$/.test(username)){authMessage("Username must be 3–24 letters, numbers, or underscores.",true);$("#authSubmit").disabled=false;return;}result=await supabaseClient.auth.signUp({email,password,options:{data:{username}}});}else result=await supabaseClient.auth.signInWithPassword({email,password});$("#authSubmit").disabled=false;if(result.error){authMessage(result.error.message,true);return;}if(mode==="signup"&&!result.data.session)authMessage("Account created. Check your email to confirm it, then sign in.");else authMessage("");};
$("#showSignup").onclick=()=>setAuthMode("signup");$("#showLogin").onclick=()=>setAuthMode("login");
$("#signOut").onclick=async()=>{await supabaseClient.auth.signOut();};
$("#closeAuth").onclick=()=>{};

document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
document.querySelectorAll(".period").forEach(b=>b.onclick=()=>{period=b.dataset.period;document.querySelectorAll(".period").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderCalendar();});
$("#prevBtn").onclick=()=>{const d=new Date(viewDate);if(period==="year")d.setFullYear(d.getFullYear()-1);else if(period==="week")d.setDate(d.getDate()-7);else if(period==="day")d.setDate(d.getDate()-1);else d.setMonth(d.getMonth()-1);viewDate=d;renderCalendar();};
$("#nextBtn").onclick=()=>{const d=new Date(viewDate);if(period==="year")d.setFullYear(d.getFullYear()+1);else if(period==="week")d.setDate(d.getDate()+7);else if(period==="day")d.setDate(d.getDate()+1);else d.setMonth(d.getMonth()+1);viewDate=d;renderCalendar();};
$("#todayBtn").onclick=()=>{viewDate=new Date();period="month";document.querySelectorAll(".period").forEach(x=>x.classList.toggle("active",x.dataset.period==="month"));renderCalendar();};
$("#calendarView").onclick=e=>{const add=e.target.closest("[data-add]"),d=e.target.closest("[data-date]"),del=e.target.closest("[data-delete]"),mon=e.target.closest("[data-month]");if(add){selectedDate=add.dataset.add;$("#modalDate").textContent=parseKey(selectedDate).toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"});$("#plInput").value="";$("#reasonInput").value="";$("#tradeModal").classList.add("show");}else if(del)deleteTrade(del.dataset.delete);else if(d){if(period==="day"){selectedDate=d.dataset.date;$("#modalDate").textContent=parseKey(selectedDate).toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"});$("#tradeModal").classList.add("show");}else{viewDate=parseKey(d.dataset.date);period="day";document.querySelectorAll(".period").forEach(x=>x.classList.toggle("active",x.dataset.period==="day"));renderCalendar();}}else if(mon){viewDate=new Date(viewDate.getFullYear(),+mon.dataset.month,1);period="month";document.querySelectorAll(".period").forEach(x=>x.classList.toggle("active",x.dataset.period==="month"));renderCalendar();}};
$("#tradeForm").onsubmit=e=>{e.preventDefault();saveTrade();};$("#closeModal").onclick=()=>$("#tradeModal").classList.remove("show");
$("#profileBtn").onclick=()=>{$("#usernameInput").value=profile.username;$("#profileModal").classList.add("show");};$("#closeProfile").onclick=()=>$("#profileModal").classList.remove("show");
$("#profileForm").onsubmit=async e=>{e.preventDefault();const username=$("#usernameInput").value.trim().replace(/^@/,"");if(!/^[A-Za-z0-9_]{3,24}$/.test(username)){alert("Username must be 3–24 letters, numbers, or underscores.");return;}const {error}=await supabaseClient.from("profiles").update({username}).eq("id",user.id);if(error){alert(error.message);return;}profile.username=username;$("#profileModal").classList.remove("show");renderAll();};
$("#shareToggle").onchange=async e=>{const {error}=await supabaseClient.from("profiles").update({share_performance:e.target.checked}).eq("id",user.id);if(error){alert(error.message);e.target.checked=profile.share_performance;return;}profile.share_performance=e.target.checked;await loadFriends();renderFriends();};
$("#sendFriend").onclick=async()=>{const input=$("#friendInput"),u=input.value.trim().replace(/^@/,""),msg=$("#friendMessage");if(!u){msg.textContent="Enter a username.";return;}const target=profiles.find(p=>p.username.toLowerCase()===u.toLowerCase());if(!target){msg.textContent="That username was not found.";return;}if(target.id===user.id){msg.textContent="You can't add yourself.";return;}const existing=friendships.find(f=>(f.requester_id===user.id&&f.addressee_id===target.id)||(f.addressee_id===user.id&&f.requester_id===target.id));if(existing){msg.textContent=existing.status==="accepted"?"You are already friends.":"A request already exists.";return;}const {error}=await supabaseClient.from("friendships").insert({requester_id:user.id,addressee_id:target.id,status:"pending"});if(error){msg.textContent=error.message;return;}input.value="";msg.textContent=`Request sent to @${target.username}.`;await loadFriends();renderFriends();};
$("#friendsList").onclick=async e=>{const accept=e.target.dataset.accept,decline=e.target.dataset.decline,perf=e.target.dataset.performance;if(perf){showFriendPerformance(perf);return;}const id=accept||decline;if(!id)return;const status=accept?"accepted":"declined";const {error}=await supabaseClient.from("friendships").update({status,updated_at:new Date().toISOString()}).eq("id",id);if(error){alert(error.message);return;}await loadFriends();renderFriends();};
$("#closePerformance").onclick=()=>$("#performanceModal").classList.remove("show");$("#chartMetric").onchange=renderAnalytics;$("#signOutTop").onclick=async()=>supabaseClient.auth.signOut();

start();
