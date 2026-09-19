'use client';
/**
 * `/dashboard` — the ResQNet Command Center.
 *
 * FE1's operator console, preserved whole and restyled to the portal's visual
 * language. Everything it shipped still works: the incident queue with its
 * filters, the map with fly-to, the incident drawer with AI summary, reasoning,
 * confidence, recommended actions, dispatch recommendations and the timeline,
 * the alert stack with acknowledgement, escalation, the emergency report modal,
 * I'm Safe, the theme toggle and the operational KPIs.
 *
 * Added here, because this is where an operator works:
 *   - a scenario runner behind RUN SCENARIO, which was previously inert
 *   - map base (Map / Satellite / Hybrid) and working layer visibility
 *   - the Gujarat district picture alongside FE1's Ahmedabad incidents
 *   - the Flash Alert workflow: recommend → operator approval → send → audit
 *
 * The KPI strip lives here rather than in the portal header: these counters
 * belong to a workflow, and putting them on every page would push the map down
 * across the whole product.
 */
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, ChevronDown, Clock3, Heart, Layers3, LocateFixed, MapPin, Play, RotateCcw, Search, Siren, Square, Truck, X } from 'lucide-react';
import { facilities, incidents, resources, alerts as seedAlerts } from '@/lib/fe1Mock';
import { Alert, Incident } from '@/types/fe1';
import { IncidentQueue } from '@/components/incidents/IncidentQueue';
import { IncidentDrawer } from '@/components/incidents/IncidentDrawer';
import { AlertStack } from '@/components/alerts/AlertStack';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FlashAlertComposer } from '@/components/flash/FlashAlertComposer';
import { FlashAlertHistory } from '@/components/flash/FlashAlertHistory';
import { recommendFlashAlert } from '@/lib/flash';
import type { FlashRecommendation } from '@/types/flash';
import type { MapBase, MapLayerKey } from '@/components/map/IncidentMap';
import { useEnvelope } from '@/components/layout/useEnvelope';
import { getDistrictSituations } from '@/lib/api';
import { ResQLogoMark } from '@/components/brand/ResQLogo';

const IncidentMap = dynamic(()=>import('@/components/map/IncidentMap'),{ssr:false,loading:()=> <div style={{height:'100%',display:'grid',placeItems:'center',background:'var(--map-loading)',color:'var(--muted)',fontSize:12}}>Loading live map…</div>});

const LAYERS: {key:MapLayerKey;label:string}[] = [
  {key:'incidents',label:'Incidents'},
  {key:'units',label:'Response units'},
  {key:'facilities',label:'Hospitals & shelters'},
  {key:'districts',label:'District risk'},
  {key:'cyclone',label:'Cyclone track'},
  {key:'flood',label:'Flood extent'},
  {key:'roads',label:'Road network'},
];

/**
 * The scripted monsoon scenario behind RUN SCENARIO.
 *
 * Each beat appends a real alert to the same stack the rest of the console
 * uses, so the demo drives the actual UI rather than a parallel animation.
 */
const SCENARIO: {after:number;alert:Omit<Alert,'id'|'acknowledged'>}[] = [
  {after:2500,alert:{kind:'critical',message:'Water level at Vasna barrage crossed the danger mark',time:'now',incidentId:'i1'}},
  {after:5500,alert:{kind:'escalation',message:'INC-0007 escalated — occupants confirmed inside the vehicle',time:'now',incidentId:'i1'}},
  {after:8500,alert:{kind:'shortage',message:'No rescue boat available in the western sector',time:'now'}},
  {after:11500,alert:{kind:'sla_breach',message:'INC-0008 hazmat dispatch approaching the 5-minute target',time:'now',incidentId:'i2'}},
];

export default function DashboardPage(){
 const [selected,setSelected]=useState<Incident|null>(incidents[0]);
 const [running,setRunning]=useState(false);
 const [alerts,setAlerts]=useState<Alert[]>(seedAlerts);
 const [query,setQuery]=useState('');
 const [showLayers,setShowLayers]=useState(false);
 const [showReport,setShowReport]=useState(false);
 const [safeSent,setSafeSent]=useState(false);
 const [base,setBase]=useState<MapBase>('map');
 const [layers,setLayers]=useState<MapLayerKey[]>(['incidents','units','facilities','districts','cyclone']);
 const [tab,setTab]=useState<'queue'|'flash'>('queue');
 const [flashDraft,setFlashDraft]=useState<FlashRecommendation|null>(null);
 const [composing,setComposing]=useState(false);
 const [district,setDistrict]=useState<string|null>(null);

 const situations=useEnvelope(useCallback(()=>getDistrictSituations(),[]));

 const filtered=useMemo(()=>incidents.filter(i=>`${i.code} ${i.title} ${i.address}`.toLowerCase().includes(query.toLowerCase())),[query]);
 const active=incidents.filter(i=>i.status!=='resolved').length;
 const p1=incidents.filter(i=>i.priority==='P1'&&i.status!=='resolved').length;
 const available=resources.filter(r=>r.status==='available').length;

 /* The scenario runner. Timers are torn down on stop and on unmount, so a
    scenario can never keep firing into a console the operator has left. */
 useEffect(()=>{
  if(!running)return;
  const timers=SCENARIO.map((beat,i)=>setTimeout(()=>{
   setAlerts(a=>[{...beat.alert,id:`scn-${Date.now()}-${i}`,acknowledged:false},...a]);
   if(i===SCENARIO.length-1)setRunning(false);
  },beat.after));
  return ()=>timers.forEach(clearTimeout);
 },[running]);

 const reset=()=>{setRunning(false);setAlerts(seedAlerts);setSafeSent(false);setSelected(incidents[0]);setQuery('');setDistrict(null)};

 const toggleLayer=(k:MapLayerKey)=>setLayers(l=>l.includes(k)?l.filter(x=>x!==k):[...l,k]);

 /* Ask the model for a warning for the open incident. It produces a
    recommendation and opens the composer; it cannot send. */
 const recommendFlash=()=>{
  if(!selected)return;
  const scenario = selected.type==='flood' ? 'flash_flood'
    : selected.type==='industrial' ? 'chemical_leak'
    : selected.type==='fire' ? 'major_fire'
    : selected.type==='building_collapse' ? 'building_collapse'
    : 'p1_life_threat';
  setFlashDraft(recommendFlashAlert({
   scenario,
   district:'Ahmedabad',
   area:selected.address,
   incidentCode:selected.code,
   peopleAffected:selected.peopleAffected,
   reportCount:selected.reportCount,
  }));
  setComposing(true);
 };

 return <main className="flex min-h-[calc(100dvh-220px)] flex-col">
  {/* ---- Console header: identity, KPIs, scenario controls ---- */}
  <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
   <span className="flex items-center gap-2">
    <ResQLogoMark className="size-7"/>
    <span className="leading-tight">
     <span className="block text-[14px] font-bold text-[var(--navy-800)]">ResQNet Command Center</span>
     <span className="eyebrow block text-[var(--muted)]">State Control Room · Ahmedabad</span>
    </span>
   </span>

   <span aria-hidden className="hidden h-8 w-px bg-[var(--border)] sm:block"/>

   <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
    <Kpi icon={<Activity size={14}/>} label="ACTIVE" value={active} accent="var(--navy-600)"/>
    <Kpi icon={<Siren size={14}/>} label="P1 OPEN" value={p1} accent="var(--crimson)"/>
    <Kpi icon={<Truck size={14}/>} label="UNITS" value={`${available}/${resources.length}`} accent="var(--blue)"/>
    <Kpi icon={<Clock3 size={14}/>} label="AVG RESPONSE" value="08:42" accent="var(--amber-600)"/>
   </div>

   <div className="ml-auto flex flex-wrap items-center gap-1.5">
    <button onClick={()=>setRunning(v=>!v)} className={`flex h-8 items-center gap-1.5 rounded-[4px] border px-2.5 text-[11px] font-bold ${running?'border-[var(--crimson-700)] bg-[var(--crimson)] text-white':'border-[var(--border-strong)] bg-white text-[var(--navy-700)] hover:bg-[var(--info-bg)]'}`}>
     {running?<Square size={13}/>:<Play size={13}/>} {running?'STOP SCENARIO':'RUN SCENARIO'}
    </button>
    <button onClick={reset} className="flex h-8 items-center gap-1.5 rounded-[4px] border border-[var(--border-strong)] bg-white px-2.5 text-[11px] font-bold text-[var(--muted)] hover:bg-[var(--surface-2)]">
     <RotateCcw size={13}/> RESET
    </button>
    <button onClick={recommendFlash} disabled={!selected} title="Ask the model to draft a public warning for this incident" className="flex h-8 items-center gap-1.5 rounded-[4px] border border-[var(--crimson-700)] bg-[var(--crimson)] px-2.5 text-[11px] font-bold text-white hover:bg-[var(--crimson-700)] disabled:opacity-45">
     <Siren size={13}/> SEND FLASH ALERT
    </button>
    <ThemeToggle/>
    <span aria-hidden className="grid size-8 place-items-center rounded-full bg-[var(--avatar)] text-[11px] font-bold text-[var(--navy-800)]">DM</span>
   </div>
  </header>

  {/* ---- Action bar ---- */}
  <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
   <span className="hidden items-center gap-2 text-[11px] font-bold text-[var(--navy-700)] lg:flex">
    AHMEDABAD <span className="text-[var(--faint)]">›</span> <span className="font-semibold text-[var(--muted)]">MONSOON RESPONSE</span>
   </span>

   <label className="relative min-w-[180px] flex-1 sm:max-w-[420px]">
    <span className="sr-only">Search location, district, incident or resource</span>
    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden/>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search location, district, incident or resource…" className="h-9 w-full rounded-[4px] border border-[var(--border-strong)] bg-white pl-8 pr-2.5 text-[12px]"/>
   </label>

   <button onClick={()=>setShowReport(true)} className="flex h-9 items-center gap-2 rounded-[4px] border border-[var(--crimson-700)] bg-[var(--crimson)] px-3 text-[11.5px] font-bold text-white hover:bg-[var(--crimson-700)]">
    <AlertTriangle size={15}/> REPORT AN EMERGENCY
   </button>

   <button onClick={()=>setSafeSent(true)} className={`flex h-9 items-center gap-2 rounded-[4px] border px-3 text-left ${safeSent?'border-[var(--green)] bg-[var(--ok-bg)]':'border-[var(--border-strong)] bg-white hover:border-[var(--green)]'}`}>
    <Heart size={15} className="text-[var(--green)]" fill={safeSent?'currentColor':'none'}/>
    <span className="leading-tight">
     <span className="block text-[11.5px] font-bold">{safeSent?"You're safe":"I'm Safe"}</span>
     <span className="block text-[9.5px] text-[var(--muted)]">{safeSent?'Control room notified':'Let your family know'}</span>
    </span>
   </button>

   <div className="ml-auto flex items-center gap-1.5">
    {/* Base layer */}
    <div className="flex overflow-hidden rounded-[4px] border border-[var(--border-strong)]">
     {(['map','satellite','hybrid'] as MapBase[]).map(b=>(
      <button key={b} onClick={()=>setBase(b)} aria-pressed={base===b} className={`px-2 py-1.5 text-[10.5px] font-bold capitalize ${base===b?'bg-[var(--navy-800)] text-white':'bg-white text-[var(--muted)] hover:bg-[var(--surface-2)]'}`}>{b}</button>
     ))}
    </div>

    <div className="relative">
     <button onClick={()=>setShowLayers(v=>!v)} aria-expanded={showLayers} className="flex h-8 items-center gap-1.5 rounded-[4px] border border-[var(--border-strong)] bg-white px-2 text-[10.5px] font-bold text-[var(--muted)] hover:bg-[var(--surface-2)]">
      <Layers3 size={13}/> LAYERS <span className="mono">{layers.length}</span> <ChevronDown size={12}/>
     </button>
     {showLayers&&(
      <fieldset className="absolute right-0 top-full z-30 mt-1 w-56 rounded-[var(--radius)] border border-[var(--border-strong)] bg-white shadow-[var(--shadow-pop)]">
       <legend className="sr-only">Map layers</legend>
       <p className="eyebrow border-b border-[var(--hairline)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[var(--muted)]">Map layers</p>
       <div className="p-1.5">
        {LAYERS.map(l=>(
         <label key={l.key} className="flex cursor-pointer items-center gap-2 rounded-[3px] px-1.5 py-1 text-[11.5px] hover:bg-[var(--surface-2)]">
          <input type="checkbox" checked={layers.includes(l.key)} onChange={()=>toggleLayer(l.key)} className="size-3.5"/>
          {l.label}
         </label>
        ))}
       </div>
       <p className="border-t border-[var(--hairline)] px-2.5 py-1.5 text-[10px] text-[var(--faint)]">Flood extent and road network are basemap features and follow the selected base.</p>
      </fieldset>
     )}
    </div>

    <button onClick={()=>setDistrict(null)} title="Reset the map to the whole state" className="flex h-8 items-center gap-1.5 rounded-[4px] border border-[var(--border-strong)] bg-white px-2 text-[10.5px] font-bold text-[var(--muted)] hover:bg-[var(--surface-2)]">
     <LocateFixed size={13}/> MY VIEW
    </button>
   </div>
  </div>

  {/* ---- Console body ---- */}
  <section className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_368px]">
   {/* Left: queue / flash alerts */}
   <aside className="flex min-h-0 flex-col border-b border-[var(--border)] bg-[var(--surface)] lg:border-b-0 lg:border-r">
    <div className="flex border-b border-[var(--border)]">
     {(['queue','flash'] as const).map(k=>(
      <button key={k} onClick={()=>setTab(k)} aria-current={tab===k} className={`flex-1 border-b-2 px-2 py-2 text-[11px] font-bold ${tab===k?'border-[var(--crimson)] text-[var(--foreground)]':'border-transparent text-[var(--muted)] hover:bg-[var(--surface-2)]'}`}>
       {k==='queue'?'INCIDENT QUEUE':'FLASH ALERTS'}
      </button>
     ))}
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">
     {tab==='queue'
      ? <IncidentQueue incidents={filtered} selectedId={selected?.id??null} onSelect={setSelected}/>
      : <div className="h-full overflow-auto p-2 thin-scroll"><FlashAlertHistory compact/></div>}
    </div>
   </aside>

   {/* Centre: the map */}
   <div className="relative min-h-[380px] lg:min-h-0">
    <IncidentMap
     incidents={incidents}
     resources={resources}
     facilities={facilities}
     selectedId={selected?.id??null}
     onSelect={setSelected}
     base={base}
     layers={layers}
     districts={situations.data??[]}
     selectedDistrict={district}
     onSelectDistrict={setDistrict}
    />
    <div className="pointer-events-none absolute bottom-2 left-2 rounded-[4px] border border-[var(--border-strong)] bg-[var(--panel-glass)] px-2 py-1 text-[10px] text-[var(--muted)]">
     <span className="mono">OSM / Esri · 23.02, 72.57</span> · district discs are a risk overlay, not administrative boundaries
    </div>
   </div>

   {/* Right: incident intelligence */}
   <aside className="min-h-0 overflow-hidden border-t border-[var(--border)] bg-[var(--surface)] xl:border-l xl:border-t-0">
    <IncidentDrawer
     incident={selected}
     alerts={alerts}
     onEscalate={()=>setAlerts(a=>[{id:`a${Date.now()}`,kind:'escalation',message:`${selected?.code} manually escalated`,time:'now',acknowledged:false,incidentId:selected?.id},...a])}
    />
   </aside>
  </section>

  <AlertStack alerts={alerts} onAck={id=>setAlerts(a=>a.map(x=>x.id===id?{...x,acknowledged:true}:x))}/>

  {showReport&&<ReportEmergency onClose={()=>setShowReport(false)} onSubmit={(text)=>{setAlerts(a=>[{id:`report-${Date.now()}`,kind:'critical',message:text,time:'now',acknowledged:false},...a]);setShowReport(false)}}/>}

  {composing&&(
   <FlashAlertComposer
    onClose={()=>{setComposing(false);setFlashDraft(null)}}
    recommendation={flashDraft}
    incident={selected?{code:selected.code,title:selected.title}:null}
   />
  )}
 </main>
}

function Kpi({icon,label,value,accent}:{icon:React.ReactNode;label:string;value:string|number;accent:string}){
 return <div className="flex items-center gap-2 rounded-[4px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1">
  <span style={{color:accent}}>{icon}</span>
  <div className="leading-tight">
   <div className="eyebrow text-[var(--muted)]">{label}</div>
   <div className="mono text-[14px] font-bold">{value}</div>
  </div>
 </div>
}

/**
 * Priority intake — FE1's emergency report modal.
 *
 * Kept as the console's own quick-intake path. The full citizen reporting
 * journey, with photo, voice, GPS and trilingual entry, lives at `/report/new`
 * and is linked from here rather than duplicated.
 */
function ReportEmergency({onClose,onSubmit}:{onClose:()=>void;onSubmit:(text:string)=>void}){
 const [type,setType]=useState('Medical emergency');
 const [message,setMessage]=useState('');
 return <div role="dialog" aria-modal="true" aria-labelledby="intake-title" className="fixed inset-0 z-[140] grid place-items-center bg-[rgba(8,18,32,.64)] p-4 backdrop-blur-[3px]">
  <div className="w-full max-w-[500px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-[var(--shadow-pop)]">
   <div className="mb-4 flex justify-between gap-4">
    <div>
     <div className="eyebrow text-[var(--crimson)]">Priority intake</div>
     <h2 id="intake-title" className="mt-1 text-[19px] font-bold">Report an Emergency</h2>
     <p className="mt-1 text-[11.5px] text-[var(--muted)]">Send a high-priority report to the ResQNet control room.</p>
    </div>
    <button onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-[4px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:bg-[var(--surface-3)]"><X size={16}/></button>
   </div>

   <label className="mb-3 flex flex-col gap-1.5 text-[11px] font-bold text-[var(--muted)]">
    EMERGENCY TYPE
    <select value={type} onChange={e=>setType(e.target.value)} className="h-9 w-full rounded-[4px] border border-[var(--border-strong)] bg-white px-2 text-[12.5px] font-normal text-[var(--foreground)]">
     <option>Medical emergency</option><option>Fire</option><option>Flood / trapped people</option><option>Road accident</option><option>Gas / chemical leak</option><option>Building collapse</option>
    </select>
   </label>

   <label className="mb-3 flex flex-col gap-1.5 text-[11px] font-bold text-[var(--muted)]">
    WHAT IS HAPPENING?
    <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Briefly describe the emergency, people affected and location…" className="min-h-[100px] w-full resize-y rounded-[4px] border border-[var(--border-strong)] bg-white p-2.5 text-[12.5px] font-normal text-[var(--foreground)]"/>
   </label>

   <p className="flex items-center gap-2 rounded-[4px] bg-[var(--surface-2)] p-2.5 text-[11px] text-[var(--muted)]">
    <MapPin size={14} className="shrink-0"/> Location attached: Ahmedabad. For the full citizen report with photo, voice and GPS, use <Link href="/report/new" className="font-bold text-[var(--navy-600)]">/report/new</Link>.
   </p>

   <div className="mt-4 flex justify-end gap-2">
    <button onClick={onClose} className="h-9 rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 text-[11.5px] font-bold text-[var(--muted)]">Cancel</button>
    <button disabled={!message.trim()} onClick={()=>onSubmit(`${type}: ${message.trim()}`)} className="flex h-9 items-center gap-2 rounded-[4px] border border-[var(--crimson-700)] bg-[var(--crimson)] px-3 text-[11.5px] font-bold text-white disabled:opacity-45">
     <Siren size={14}/> Send emergency report
    </button>
   </div>
  </div>
 </div>
}
