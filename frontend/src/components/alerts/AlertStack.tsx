'use client';
import { pageStrings } from '@/lib/pageStrings';
import { labels } from '@/lib/i18n';
import { useLang } from '@/components/layout/LangProvider';
import { AlertTriangle, BellRing, Check, Siren, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Alert } from '@/components/command/view';
import { armChime, chimeReady, isMuted, playAlertChime, setMuted } from '@/lib/alertChime';

export function AlertStack({alerts,onAck}:{alerts:Alert[];onAck:(id:string)=>void}){
 const active=alerts.filter(a=>!a.acknowledged);
 const [muted,setMutedState]=useState(false);
 const [armed,setArmed]=useState(false);
 // IDs already chimed for, so a poll that re-delivers the same alert is silent
 // and only a genuinely new one makes a sound.
 const heard=useRef<Set<string>|null>(null);

 // Deferred: reading device storage and setting state synchronously in an
 // effect would desync the server-rendered markup and cascade a render.
 useEffect(()=>{const t=setTimeout(()=>setMutedState(isMuted()),0);return ()=>clearTimeout(t);},[]);

 // Browsers will not start audio without a gesture. Arm on the first click
 // anywhere, then stop listening.
 useEffect(()=>{
  const onGesture=()=>{void armChime().then(ok=>setArmed(ok));};
  window.addEventListener('pointerdown',onGesture,{once:true});
  return ()=>window.removeEventListener('pointerdown',onGesture);
 },[]);

 useEffect(()=>{
  const urgent=active.filter(a=>a.kind==='critical'||a.kind==='escalation');
  // The first render after a reload is not "new alerts arriving" — it is the
  // backlog. Seed the set without sounding, or every refresh becomes an alarm.
  if(heard.current===null){heard.current=new Set(urgent.map(a=>a.id));return;}
  const fresh=urgent.filter(a=>!heard.current!.has(a.id));
  for(const a of fresh)heard.current.add(a.id);
  if(fresh.length>0)playAlertChime();
 },[active]);

 const lang=useLang().lang; const t=pageStrings(lang).misc.alerts; const L=labels(lang);
 if(!active.length)return null;
 const soundBlocked=!armed&&!chimeReady();
 return <div style={{position:'fixed',left:346,bottom:18,width:360,zIndex:20,display:'grid',gap:7}}>
  <div style={{display:'flex',alignItems:'center',gap:7,justifyContent:'flex-end',fontSize:9,color:'var(--muted)'}}>
   {soundBlocked&&!muted&&<span title={t.soundBlockedNote}>{t.soundBlocked}</span>}
   <button onClick={()=>{const next=!muted;setMuted(next);setMutedState(next);}} title={muted?t.unmute:t.mute} style={{display:'flex',alignItems:'center',gap:5,border:'1px solid var(--line-strong)',background:'var(--panel-glass)',color:'var(--muted)',borderRadius:4,height:22,padding:'0 7px',fontSize:8,fontWeight:800,cursor:'pointer'}}>
    {muted?<VolumeX size={11}/>:<Volume2 size={11}/>} {muted?t.muted:t.soundOn}
   </button>
  </div>{active.slice(0,3).map(a=><div key={a.id} style={{padding:11,borderRadius:7,border:`1px solid ${a.kind==='critical'||a.kind==='escalation'?'#b91c1c':'#8a6a2a'}`,background:'var(--panel-glass)',boxShadow:'0 14px 35px #0009',backdropFilter:'blur(12px)'}}><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{color:a.kind==='critical'||a.kind==='escalation'?'#dc2626':'#d97706'}}>{a.kind==='escalation'?<Siren size={15}/>:a.kind==='critical'?<BellRing size={15}/>:<AlertTriangle size={15}/>}</span><b style={{fontSize:9,letterSpacing:1}}>{L.alertKind[a.kind]??a.kind.replace('_',' ').toUpperCase()}</b><span style={{marginLeft:'auto',fontSize:8,color:'var(--muted)'}}>{a.time}</span><button onClick={()=>onAck(a.id)} style={{border:0,background:'transparent',color:'var(--muted)'}}><X size={13}/></button></div><div style={{fontSize:10,color:'var(--body-text)',lineHeight:1.4,margin:'7px 0 8px 23px'}}>{a.message}</div><button onClick={()=>onAck(a.id)} style={{marginLeft:23,border:'1px solid var(--line-strong)',background:'var(--soft-bg)',color:'var(--accent)',height:24,borderRadius:4,fontSize:8,fontWeight:800,padding:'0 8px',display:'flex',alignItems:'center',gap:5}}>{t.acknowledge} <Check size={10}/></button></div>)}</div>}
