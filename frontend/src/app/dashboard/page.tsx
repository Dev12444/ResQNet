'use client';
import './dashboard.css';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, Clock3, FileText, Layers3, Loader2, LocateFixed, MapPin, Phone, Play, RotateCcw, Search, Siren, Square, Truck, Wifi, WifiOff, X } from 'lucide-react';
import { IncidentQueue } from '@/components/incidents/IncidentQueue';
import { IncidentDrawer } from '@/components/incidents/IncidentDrawer';
import { AlertStack } from '@/components/alerts/AlertStack';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCommandCenter } from '@/components/command/useCommandCenter';
import { byUrgency, toViewAlert, toViewFacility, toViewIncident, toViewResource } from '@/components/command/view';
import type { Incident as ViewIncident } from '@/components/command/view';
import { submitReport, USE_MOCK } from '@/lib/api';
import { acknowledgeAlert, escalateIncident, generateSitrep, resolveIncident, simulator } from '@/lib/command';

const IncidentMap = dynamic(()=>import('@/components/map/IncidentMap'),{ssr:false,loading:()=> <div style={{height:'100%',display:'grid',placeItems:'center',background:'var(--map-loading)',color:'var(--muted)'}}>Loading live map…</div>});

function mmss(sec:number){const m=Math.floor(sec/60),s=Math.round(sec%60);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}

export default function DashboardPage(){
 const cc=useCommandCenter();
 const selectedId=cc.selectedId, setSelectedId=cc.select;
 const running=cc.sim.running;
 const [busy,setBusy]=useState<string|null>(null);
 const [toast,setToast]=useState<string|null>(null);
 const [query,setQuery]=useState('');
 const [showLayers,setShowLayers]=useState(false);
 // The three MAP LAYERS boxes were rendered with `defaultChecked` and no
 // handler, so ticking them changed nothing. A control that looks operational
 // and is not is worse on a command surface than no control at all.
 const [layers,setLayers]=useState({incidents:true,units:true,facilities:true});
 const toggleLayer=(k:keyof typeof layers)=>setLayers(v=>({...v,[k]:!v[k]}));
 const [showReport,setShowReport]=useState(false);
 const [sitrep,setSitrep]=useState<string|null>(null);
 const [now,setNow]=useState<Date|null>(null);
 useEffect(()=>{const tick=()=>setNow(new Date());const t0=setTimeout(tick,0);const t=setInterval(tick,1000);return()=>{clearTimeout(t0);clearInterval(t)}},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),5000);return()=>clearTimeout(t)},[toast]);

 const sorted=useMemo(()=>[...cc.incidents].sort(byUrgency),[cc.incidents]);
 const incidents=useMemo(()=>sorted.map(i=>toViewIncident(i,cc.detail?.id===i.id?cc.detail.reports:[])),[sorted,cc.detail]);
 const resources=useMemo(()=>cc.resources.map(toViewResource),[cc.resources]);
 const facilities=useMemo(()=>cc.facilities.map(toViewFacility),[cc.facilities]);
 const alerts=useMemo(()=>cc.alerts.map(toViewAlert),[cc.alerts]);
 const filtered=useMemo(()=>incidents.filter(i=>`${i.code} ${i.title} ${i.address}`.toLowerCase().includes(query.toLowerCase())),[incidents,query]);
 const selected=incidents.find(i=>Number(i.id)===selectedId)??null;
 const select=(i:ViewIncident)=>setSelectedId(Number(i.id));

 const active=cc.incidents.filter(i=>i.status!=='resolved').length;
 const p1=cc.incidents.filter(i=>i.priority==='P1'&&i.status!=='resolved').length;
 const available=cc.resources.filter(r=>r.status==='available').length;
 const waits=cc.incidents.filter(i=>i.dispatched_at).map(i=>(Date.parse(i.dispatched_at!)-Date.parse(i.created_at))/1000).filter(s=>s>=0);
 const avgResponse=waits.length?mmss(waits.reduce((a,b)=>a+b,0)/waits.length):'—';
 const online=USE_MOCK?false:cc.live||cc.mode==='live';

 const act=async(name:string,fn:()=>Promise<unknown>,ok?:string)=>{setBusy(name);try{await fn();if(ok)setToast(ok);await cc.refresh()}catch(e){setToast(`${name} failed: ${e instanceof Error?e.message:'error'}`)}finally{setBusy(null)}};
 const scenario=()=>act(running?'Stop scenario':'Run scenario',async()=>{await simulator(running?'stop':'start');cc.setSim(s=>({...s,running:!running}))},running?'Scenario stopped':'Scenario started: reports will stream in');
 const reset=()=>act('Reset',async()=>{await simulator('reset');cc.setSim({running:false,events_sent:0,events_total:0});cc.resetSelection()},'Demo data reset');
 const openSitrep=()=>act('SITREP',async()=>setSitrep(await generateSitrep()));

 return <main className="cc-root" style={{height:'100vh',display:'grid',gridTemplateRows:'64px 38px 52px 1fr',overflow:'hidden'}}>
  <header style={{display:'flex',alignItems:'center',gap:18,padding:'0 18px',background:'var(--nav-bg)',borderBottom:'1px solid var(--line)'}}>
   <Link href="/" style={{display:'flex',alignItems:'center',gap:11,minWidth:220,color:'inherit',textDecoration:'none'}}><ResQLogo/><div><div className="logo-wordmark" style={{fontWeight:800}}>ResQ<span style={{color:'var(--accent)'}}>Net</span></div><div style={{fontSize:9,color:'var(--muted)',letterSpacing:1.6,fontWeight:700}}>EMERGENCY COMMAND CENTER</div></div></Link>
   <div style={{height:34,width:1,background:'var(--line)'}}/>
   <Kpi icon={<Activity size={15}/>} label="ACTIVE" value={active} accent="var(--accent)"/><Kpi icon={<Siren size={15}/>} label="P1 OPEN" value={p1} accent="#ef4444"/><Kpi icon={<Truck size={15}/>} label="UNITS FREE" value={`${available}/${cc.resources.length}`} accent="#0284c7"/><Kpi icon={<Clock3 size={15}/>} label="AVG TO DISPATCH" value={avgResponse} accent="#f59e0b"/>
   <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
    <span title={cc.error??undefined} style={{fontSize:11,color:online?'var(--accent)':'var(--amber)',display:'flex',gap:6,alignItems:'center'}}>{online?<Wifi size={13}/>:<WifiOff size={13}/>} {USE_MOCK?'DEMO DATA':online?'LIVE':'RECONNECTING'}</span>
    <button onClick={openSitrep} disabled={busy==='SITREP'} style={topButton('var(--button-bg)')}>{busy==='SITREP'?<Loader2 size={14} className="spin"/>:<FileText size={14}/>} SITREP</button>
    <button onClick={scenario} disabled={!!busy} style={topButton(running?'#7f1d1d':'var(--run-bg)')}>{running?<Square size={14}/>:<Play size={14}/>} {running?`STOP SCENARIO${cc.sim.events_total?` ${cc.sim.events_sent}/${cc.sim.events_total}`:''}`:'RUN SCENARIO'}</button>
    <button onClick={reset} disabled={!!busy} style={topButton('var(--button-bg)')}><RotateCcw size={14}/> RESET</button>
    <ThemeToggle/>
   </div>
  </header>
  <div className="emergency-bar"><div className="emergency-label"><Phone size={13}/> EMERGENCY CONTACTS</div><div className="emergency-links">{[['112','EMERGENCY'],['108','AMBULANCE'],['101','FIRE'],['100','POLICE'],['1070','STATE EOC'],['1077','DISTRICT CONTROL'],['1098','CHILD HELPLINE'],['181','WOMEN HELPLINE']].map(([num,label])=><a key={num} href={`tel:${num}`} className="emergency-link"><strong>{num}</strong><span>• {label}</span></a>)}</div><div className="utility-live"><span className="live-dot" style={online?undefined:{background:'#f59e0b'}}/> {online?'LIVE':'OFFLINE'} • {now?now.toLocaleTimeString('en-IN',{hour12:false}):''}</div></div>
  <div className="action-bar"><div className="context-path"><span>AHMEDABAD</span><span>›</span><span>MONSOON RESPONSE</span></div><div className="action-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search incident code, title or location…"/></div><button className="report-btn" onClick={()=>setShowReport(true)}><AlertTriangle size={17}/> LOG A CALL <span>→</span></button><div className="action-tools"><button onClick={()=>setShowLayers(v=>!v)} style={toolButton}><Layers3 size={14}/> LAYERS <ChevronDown size={13}/></button><button onClick={()=>setSelectedId(null)} style={toolButton}><LocateFixed size={14}/> CITY VIEW</button></div></div>
  <section style={{minHeight:0,display:'grid',gridTemplateColumns:'330px minmax(0,1fr) 420px',background:'var(--bg)'}}>
   <aside style={{minHeight:0,borderRight:'1px solid var(--line)',background:'var(--panel)'}}>{!cc.loaded?<div style={{padding:20,fontSize:11,color:'var(--muted)',display:'flex',gap:8,alignItems:'center'}}><Loader2 size={14} className="spin"/> Connecting to control room…</div>:cc.mode==='unavailable'?<div style={{padding:18}}><div style={{display:'flex',gap:7,alignItems:'center',fontSize:11,fontWeight:800,color:'var(--amber)'}}><WifiOff size={14}/> INCIDENT FEED UNAVAILABLE</div><div style={{marginTop:8,fontSize:11,color:'var(--muted)',lineHeight:1.6}}>{cc.error??'The API did not answer.'}</div><div style={{marginTop:8,fontSize:11,color:'var(--muted)',lineHeight:1.6}}>An empty queue here means the control room could not be reached — not that the city is quiet.</div><button onClick={()=>void cc.refresh()} style={{marginTop:11,display:'flex',gap:6,alignItems:'center',padding:'6px 10px',borderRadius:5,border:'1px solid var(--line-strong)',background:'var(--button-bg)',color:'var(--text)',fontSize:11,fontWeight:700,cursor:'pointer'}}><RotateCcw size={12}/> Retry</button></div>:<IncidentQueue incidents={filtered} selectedId={selected?.id??null} onSelect={select}/>}</aside>
   <div style={{position:'relative',minWidth:0}}><IncidentMap incidents={layers.incidents?incidents:[]} resources={layers.units?resources:[]} facilities={layers.facilities?facilities:[]} selectedId={selected?.id??null} onSelect={select}/>{showLayers&&<div style={{position:'absolute',top:14,right:14,width:210,padding:14,background:'var(--panel-glass)',border:'1px solid var(--line-strong)',borderRadius:8,boxShadow:'0 15px 35px #0008'}}><div style={{fontWeight:800,fontSize:12,marginBottom:12}}>MAP LAYERS</div>{([['incidents','Incidents'],['units','Response units'],['facilities','Hospitals & shelters']] as const).map(([key,label])=><label key={key} style={{display:'flex',gap:8,alignItems:'center',fontSize:11,color:'var(--body-text)',margin:'10px 0',cursor:'pointer'}}><input type="checkbox" checked={layers[key]} onChange={()=>toggleLayer(key)}/>{label}</label>)}</div>}<div style={{position:'absolute',left:16,bottom:16,padding:'8px 10px',borderRadius:6,background:'var(--panel-glass)',border:'1px solid var(--line-strong)',fontSize:10,color:'var(--muted)'}}>OSM · {layers.incidents?incidents.length:0} incidents · {layers.units?resources.length:0} units · {layers.facilities?facilities.length:0} facilities</div></div>
   <aside style={{minHeight:0,borderLeft:'1px solid var(--line)',background:'var(--panel)',overflow:'hidden'}}><IncidentDrawer incident={selected} alerts={alerts} version={cc.version} onClose={()=>setSelectedId(null)} onDispatched={()=>{setToast(`${selected?.code} dispatched`);void cc.refresh()}} onEscalate={()=>selected&&act('Escalate',()=>escalateIncident(Number(selected.id)),`${selected.code} escalated`)} onResolve={()=>selected&&act('Resolve',async()=>{await resolveIncident(Number(selected.id));cc.resetSelection()},`${selected.code} resolved: units released`)}/></aside>
  </section>
  <AlertStack alerts={alerts} onAck={id=>act('Acknowledge',()=>acknowledgeAlert(Number(id)))}/>
  {toast&&<div role="status" style={{position:'fixed',left:'50%',bottom:22,transform:'translateX(-50%)',zIndex:30,padding:'10px 14px',borderRadius:8,background:'var(--panel-glass)',border:'1px solid var(--line-strong)',fontSize:11,boxShadow:'0 14px 35px #0009'}}>{toast}</div>}
  {showReport&&<LogCall onClose={()=>setShowReport(false)} onCreated={(id,code,merged)=>{setShowReport(false);setSelectedId(id);setToast(merged?`Merged into ${code} (duplicate detected)`:`New incident ${code} created`);void cc.refresh()}}/>}
  {sitrep!==null&&<div className="modal-backdrop" onClick={()=>setSitrep(null)}><div className="report-modal" style={{width:'min(720px,94vw)'}} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="modal-kicker" style={{color:'var(--accent)'}}>AI GENERATED</div><h2>Situation Report</h2></div><button onClick={()=>setSitrep(null)} className="icon-btn"><X size={18}/></button></div><pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:12,lineHeight:1.55,maxHeight:'60vh',overflow:'auto',margin:0,color:'var(--body-text)'}}>{sitrep}</pre><div className="modal-actions"><button className="secondary-btn" onClick={()=>navigator.clipboard?.writeText(sitrep)}>Copy</button><button className="secondary-btn" onClick={()=>window.print()}>Print</button></div></div></div>}
 </main>
}
function ResQLogo(){return <div aria-label="ResQNet logo" style={{width:36,height:36,border:'1px solid var(--accent-border)',borderRadius:10,display:'grid',placeItems:'center',background:'var(--soft-bg)',boxShadow:'inset 0 0 0 1px rgba(255,255,255,.03)'}}>
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 2.8 19 5.7v5.6c0 4.45-2.76 8.1-7 9.9-4.24-1.8-7-5.45-7-9.9V5.7L12 2.8Z" stroke="var(--accent)" strokeWidth="1.55"/>
  <path d="M8.2 12.1h2.25l1.1-3.15 1.55 6.1 1.05-2.95h1.65" stroke="var(--accent)" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"/>
  <circle cx="12" cy="12" r="1.05" fill="var(--accent)"/>
 </svg>
 </div>}

function Kpi({icon,label,value,accent}:{icon:React.ReactNode;label:string;value:string|number;accent:string}){return <div style={{display:'flex',alignItems:'center',gap:9,padding:'0 13px',borderRight:'1px solid var(--line)'}}><span style={{color:accent}}>{icon}</span><div><div style={{fontSize:9,color:'var(--muted)',letterSpacing:1.2}}>{label}</div><div className="kpi-value" style={{fontWeight:800,fontSize:15,lineHeight:1.2}}>{value}</div></div></div>}
const topButton=(bg:string):React.CSSProperties=>({display:'flex',alignItems:'center',gap:6,height:31,padding:'0 10px',borderRadius:6,border:'1px solid var(--line-strong)',background:bg,color:'var(--text)',fontSize:10,fontWeight:800});
const toolButton:React.CSSProperties={display:'flex',alignItems:'center',gap:6,height:30,padding:'0 9px',borderRadius:6,border:'1px solid var(--line-strong)',background:'var(--input)',color:'var(--muted)',fontSize:10,fontWeight:700};

/** Dispatcher logs a 112/108 call: goes through the same AI pipeline as every other report. */
function LogCall({onClose,onCreated}:{onClose:()=>void;onCreated:(incidentId:number,code:string,merged:boolean)=>void}){
 const [message,setMessage]=useState(''); const [where,setWhere]=useState(''); const [sending,setSending]=useState(false); const [error,setError]=useState('');
 const send=async()=>{setSending(true);setError('');try{const text=where.trim()?`${message.trim()} (Location: ${where.trim()})`:message.trim();const r=await submitReport({source:'call',text,lang:null,lat:null,lng:null,address:where.trim()||null,photo_url:null,reporter:'Control room',sensor:null});onCreated(r.incident.id,r.incident.code,r.merged)}catch(e){setError(e instanceof Error?e.message:'Could not send');setSending(false)}};
 return <div className="modal-backdrop"><div className="report-modal"><div className="modal-head"><div><div className="modal-kicker">PRIORITY INTAKE</div><h2>Log an emergency call</h2><p>Type what the caller says, in any language. AI classifies, locates and de-duplicates it.</p></div><button onClick={onClose} className="icon-btn"><X size={18}/></button></div><label>What is happening?<textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="e.g. અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી વધી રહ્યું છે"/></label><label>Location (area / landmark)<input value={where} onChange={e=>setWhere(e.target.value)} placeholder="e.g. Akhbarnagar underpass" style={{border:'1px solid var(--line-strong)',background:'var(--input)',color:'var(--text)',borderRadius:7,padding:10,fontSize:11,outline:0}}/></label><div className="report-location"><MapPin size={15}/> No GPS: the area name is geocoded from the Ahmedabad gazetteer.</div>{error&&<div style={{marginTop:8,fontSize:10,color:'var(--danger-text)'}}>{error}</div>}<div className="modal-actions"><button className="secondary-btn" onClick={onClose}>Cancel</button><button className="submit-report" disabled={!message.trim()||sending} onClick={send}>{sending?<Loader2 size={15} className="spin"/>:<Siren size={15}/>} Send to triage</button></div></div></div>
}
