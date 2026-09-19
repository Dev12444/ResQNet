'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bell, Bot, ChevronDown, Clock3, Globe2, Heart, Layers3, LocateFixed, MapPin, Phone, Play, Radio, RotateCcw, Search, Siren, Square, Truck, Users, Wifi, X } from 'lucide-react';
import { facilities, incidents, resources, alerts as seedAlerts } from '@/lib/mock';
import { Incident } from '@/types';
import { IncidentQueue } from '@/components/incidents/IncidentQueue';
import { IncidentDrawer } from '@/components/incidents/IncidentDrawer';
import { AlertStack } from '@/components/alerts/AlertStack';
import { ThemeToggle } from '@/components/ThemeToggle';

const IncidentMap = dynamic(()=>import('@/components/map/IncidentMap'),{ssr:false,loading:()=> <div style={{height:'100%',display:'grid',placeItems:'center',background:'var(--map-loading)',color:'var(--muted)'}}>Loading live map…</div>});

export default function DashboardPage(){
 const [selected,setSelected]=useState<Incident|null>(incidents[0]);
 const [running,setRunning]=useState(false);
 const [alerts,setAlerts]=useState(seedAlerts);
 const [query,setQuery]=useState('');
 const [showLayers,setShowLayers]=useState(false);
 const [showReport,setShowReport]=useState(false);
 const [safeSent,setSafeSent]=useState(false);
 const filtered=useMemo(()=>incidents.filter(i=>`${i.code} ${i.title} ${i.address}`.toLowerCase().includes(query.toLowerCase())),[query]);
 const active=incidents.filter(i=>i.status!=='resolved').length;
 const p1=incidents.filter(i=>i.priority==='P1'&&i.status!=='resolved').length;
 const available=resources.filter(r=>r.status==='available').length;
 return <main style={{height:'100vh',display:'grid',gridTemplateRows:'64px 38px 52px 1fr',overflow:'hidden'}}>
  <header style={{display:'flex',alignItems:'center',gap:18,padding:'0 18px',background:'var(--nav-bg)',borderBottom:'1px solid var(--line)'}}>
   <div style={{display:'flex',alignItems:'center',gap:11,minWidth:220}}><ResQLogo/><div><div className="logo-wordmark" style={{fontWeight:800}}>ResQ<span style={{color:'var(--accent)'}}>Net</span></div><div style={{fontSize:9,color:'var(--muted)',letterSpacing:1.6,fontWeight:700}}>EMERGENCY COMMAND CENTER</div></div></div>
   <div style={{height:34,width:1,background:'var(--line)'}}/>
   <Kpi icon={<Activity size={15}/>} label="ACTIVE" value={active} accent="var(--accent)"/><Kpi icon={<Siren size={15}/>} label="P1 OPEN" value={p1} accent="#ef4444"/><Kpi icon={<Truck size={15}/>} label="UNITS" value={`${available}/${resources.length}`} accent="#0284c7"/><Kpi icon={<Clock3 size={15}/>} label="AVG RESPONSE" value="08:42" accent="#f59e0b"/>
   <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:11,color:'var(--muted)',display:'flex',gap:6,alignItems:'center'}}><Wifi size={13} color="var(--accent)"/> LIVE</span><button onClick={()=>setRunning(v=>!v)} style={topButton(running?'#7f1d1d':'var(--run-bg)')}>{running?<Square size={14}/>:<Play size={14}/>} {running?'STOP SCENARIO':'RUN SCENARIO'}</button><button onClick={()=>setRunning(false)} style={topButton('var(--button-bg)')}><RotateCcw size={14}/> RESET</button><ThemeToggle/><div style={{width:34,height:34,borderRadius:'50%',background:'var(--avatar)',display:'grid',placeItems:'center',fontSize:12,fontWeight:800}}>DM</div></div>
  </header>
  <div className="emergency-bar"><div className="emergency-label"><Phone size={13}/> EMERGENCY CONTACTS</div><div className="emergency-links">{[['100','POLICE'],['101','FIRE'],['108','AMBULANCE'],['112','EMERGENCY'],['1098','CHILD HELPLINE'],['181','WOMEN HELPLINE'],['1077','DISASTER HELPLINE']].map(([num,label])=><a key={num} href={`tel:${num}`} className="emergency-link"><strong>{num}</strong><span>• {label}</span></a>)}</div><div className="utility-live"><span className="live-dot"/> LIVE • 12:30:18</div></div>
  <div className="action-bar"><div className="context-path"><span>AHMEDABAD</span><span>›</span><span>MONSOON RESPONSE</span></div><div className="action-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search location, district, incident or resource…"/></div><button className="report-btn" onClick={()=>setShowReport(true)}><AlertTriangle size={17}/> REPORT AN EMERGENCY <span>→</span></button><button className={`safe-btn ${safeSent?'safe-sent':''}`} onClick={()=>setSafeSent(true)}><Heart size={17} fill={safeSent?'currentColor':'none'}/><span><strong>{safeSent?"You're Safe":"I'm Safe"}</strong><small>{safeSent?'Family notification sent':'Let your family know you are safe'}</small></span><span className="safe-arrow">›</span></button><div className="action-tools"><button onClick={()=>setShowLayers(v=>!v)} style={toolButton}><Layers3 size={14}/> LAYERS <ChevronDown size={13}/></button><button style={toolButton}><LocateFixed size={14}/> MY VIEW</button></div></div>
  <section style={{minHeight:0,display:'grid',gridTemplateColumns:'330px minmax(0,1fr) 420px',background:'var(--bg)'}}>
   <aside style={{minHeight:0,borderRight:'1px solid var(--line)',background:'var(--panel)'}}><IncidentQueue incidents={filtered} selectedId={selected?.id??null} onSelect={setSelected}/></aside>
   <div style={{position:'relative',minWidth:0}}><IncidentMap incidents={incidents} resources={resources} facilities={facilities} selectedId={selected?.id??null} onSelect={setSelected}/>{showLayers&&<div style={{position:'absolute',top:14,right:14,width:210,padding:14,background:'var(--panel-glass)',border:'1px solid var(--line-strong)',borderRadius:8,boxShadow:'0 15px 35px #0008'}}><div style={{fontWeight:800,fontSize:12,marginBottom:12}}>MAP LAYERS</div>{['Incidents','Response units','Hospitals & shelters','Flood extent','Road network'].map((x,i)=><label key={x} style={{display:'flex',gap:8,alignItems:'center',fontSize:11,color:'var(--body-text)',margin:'10px 0'}}><input type="checkbox" defaultChecked={i<3}/>{x}</label>)}</div>}<div style={{position:'absolute',left:16,bottom:16,padding:'8px 10px',borderRadius:6,background:'var(--panel-glass)',border:'1px solid var(--line-strong)',fontSize:10,color:'var(--muted)'}}>OSM / OpenFreeMap · 23.0225, 72.5714 · Z11</div></div>
   <aside style={{minHeight:0,borderLeft:'1px solid var(--line)',background:'var(--panel)',overflow:'hidden'}}><IncidentDrawer incident={selected} alerts={alerts} onEscalate={()=>setAlerts(a=>[{id:`a${Date.now()}`,kind:'escalation',message:`${selected?.code} manually escalated`,time:'now',acknowledged:false,incidentId:selected?.id},...a])}/></aside>
  </section>
  <AlertStack alerts={alerts} onAck={id=>setAlerts(a=>a.map(x=>x.id===id?{...x,acknowledged:true}:x))}/>
  {showReport&&<ReportEmergency onClose={()=>setShowReport(false)} onSubmit={(text)=>{setAlerts(a=>[{id:`report-${Date.now()}`,kind:'critical',message:text,time:'now',acknowledged:false},...a]);setShowReport(false)}}/>}
 </main>
}
function ResQLogo(){return <div aria-label="ResQNet logo" style={{width:36,height:36,border:'1px solid var(--accent-border)',borderRadius:10,display:'grid',placeItems:'center',background:'var(--soft-bg)',boxShadow:'inset 0 0 0 1px rgba(255,255,255,.03)'}}>
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 2.8 19 5.7v5.6c0 4.45-2.76 8.1-7 9.9-4.24-1.8-7-5.45-7-9.9V5.7L12 2.8Z" stroke="var(--accent)" strokeWidth="1.55"/>
  <path d="M8.2 12.1h2.25l1.1-3.15 1.55 6.1 1.05-2.95h1.65" stroke="var(--accent)" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"/>
  <circle cx="12" cy="12" r="1.05" fill="var(--accent)"/>
 </svg>
 </div>}

function Kpi({icon,label,value,accent}:{icon:React.ReactNode;label:string;value:string|number;accent:string}){return <div style={{display:'flex',alignItems:'center',gap:9,padding:'0 13px',borderRight:'1px solid var(--line)'}}><span style={{color:accent}}>{icon}</span><div><div style={{fontSize:9,color:'var(--muted)',letterSpacing:1.2}}>{label}</div><div style={{fontWeight:800,fontSize:15,lineHeight:1.2}}>{value}</div></div></div>}
const topButton=(bg:string):React.CSSProperties=>({display:'flex',alignItems:'center',gap:6,height:31,padding:'0 10px',borderRadius:6,border:'1px solid var(--line-strong)',background:bg,color:'var(--text)',fontSize:10,fontWeight:800});
const toolButton:React.CSSProperties={display:'flex',alignItems:'center',gap:6,height:30,padding:'0 9px',borderRadius:6,border:'1px solid var(--line-strong)',background:'var(--input)',color:'var(--muted)',fontSize:10,fontWeight:700};

function ReportEmergency({onClose,onSubmit}:{onClose:()=>void;onSubmit:(text:string)=>void}){
 const [type,setType]=useState('Medical emergency'); const [message,setMessage]=useState('');
 return <div className="modal-backdrop"><div className="report-modal"><div className="modal-head"><div><div className="modal-kicker">PRIORITY INTAKE</div><h2>Report an Emergency</h2><p>Send a high-priority report to the ResQNet control room.</p></div><button onClick={onClose} className="icon-btn"><X size={18}/></button></div><label>Emergency type<select value={type} onChange={e=>setType(e.target.value)}><option>Medical emergency</option><option>Fire</option><option>Flood / trapped people</option><option>Road accident</option><option>Gas / chemical leak</option><option>Building collapse</option></select></label><label>What is happening?<textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Briefly describe the emergency, people affected and location…"/></label><div className="report-location"><MapPin size={15}/> Location attached: Ahmedabad • device location permission not required for demo</div><div className="modal-actions"><button className="secondary-btn" onClick={onClose}>Cancel</button><button className="submit-report" disabled={!message.trim()} onClick={()=>onSubmit(`${type}: ${message.trim()}`)}><Siren size={15}/> Send emergency report</button></div></div></div>
}
