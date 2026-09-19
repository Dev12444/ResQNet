"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, MapPin, Navigation, ShieldCheck, Users, X } from "lucide-react";
import type { QueueIncident } from "../incidents/IncidentQueue";

type Props = { incident: QueueIncident | null; onClose: () => void; onDispatch: (id: string) => void };

export default function IncidentDrawer({ incident, onClose, onDispatch }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!incident) return null;

  return (
    <aside className="absolute inset-y-3 right-3 z-20 flex w-[min(390px,calc(100%-24px))] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#100d15]/96 shadow-2xl shadow-black/50 backdrop-blur-2xl">
      <div className="border-b border-white/8 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-300 ring-1 ring-red-400/15"><AlertTriangle size={18} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-300">{incident.priority}</span><span className="text-[10px] text-white/30">{incident.code}</span></div>
            <h2 className="mt-1 text-base font-semibold text-white">{incident.title}</h2>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/40"><MapPin size={11} />{incident.address}</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white"><X size={15} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Severity" value={`${incident.severity}/5`} />
          <Metric label="Reports" value={`${incident.reportCount}`} />
          <Metric label="Waiting" value={`${incident.ageMin}m`} />
        </div>

        <div className="mt-4 rounded-2xl border border-purple-400/15 bg-purple-500/[0.07] p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-purple-200"><ShieldCheck size={13} /> AI assessment</div>
          <p className="mt-2 text-xs leading-5 text-white/70">Water is rising near a populated underpass and multiple reports indicate a vehicle may be trapped. Treat as a high-priority flood response and verify access route before dispatch.</p>
          <div className="mt-3 flex items-center justify-between text-[10px] text-white/40"><span>Confidence</span><span className="font-semibold text-purple-200">94%</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full w-[94%] rounded-full bg-purple-400" /></div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-white">Recommended response</h3><span className="text-[10px] text-white/30">ETA</span></div>
          <Recommendation title="NDRF rescue team" meta="Rescue boat · nearest available" eta="9 min" />
          <Recommendation title="Ambulance 108-AMD-07" meta="Medical support" eta="6 min" />
          <Recommendation title="Civil Hospital" meta="Nearest facility with beds" eta="12 min" />
        </div>

        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/8 px-3 py-2.5 text-left text-[11px] text-white/60 hover:bg-white/[0.03]">
          <span>Why was this prioritised?</span><span>{expanded ? "−" : "+"}</span>
        </button>
        {expanded && <p className="px-3 pt-2 text-[11px] leading-5 text-white/40">P1 is triggered by severity ≥ 4 or hazards such as trapped people, according to the ResQNet priority rule.</p>}

        <div className="mt-4 rounded-2xl border border-white/8 p-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-white/70"><Clock3 size={12} /> Response timeline</div>
          <Timeline label="Report received" time={`${incident.ageMin} min ago`} done />
          <Timeline label="AI triage complete" time="12 sec later" done />
          <Timeline label="Human approval" time="Waiting" />
          <Timeline label="Responder on scene" time="Pending" />
        </div>
      </div>

      <div className="border-t border-white/8 p-4">
        {incident.assigned ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 py-3 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/15"><CheckCircle2 size={15} /> Response team assigned</div>
        ) : (
          <button type="button" onClick={() => onDispatch(incident.id)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-bold text-[#17121e] shadow-lg shadow-white/10 transition hover:bg-purple-50"><Navigation size={14} /> Approve dispatch</button>
        )}
        <p className="mt-2 text-center text-[9px] text-white/25">AI recommends · dispatcher approves</p>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3"><div className="text-[9px] uppercase tracking-wider text-white/30">{label}</div><div className="mt-1 text-sm font-semibold text-white">{value}</div></div>;
}

function Recommendation({ title, meta, eta }: { title: string; meta: string; eta: string }) {
  return <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.045] text-purple-200"><Users size={14} /></div><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold text-white">{title}</div><div className="mt-0.5 truncate text-[9px] text-white/35">{meta}</div></div><div className="text-right"><div className="text-[11px] font-semibold text-white">{eta}</div><div className="text-[8px] text-white/25">ETA</div></div></div>;
}

function Timeline({ label, time, done = false }: { label: string; time: string; done?: boolean }) {
  return <div className="relative ml-1 border-l border-white/10 py-2 pl-4"><span className={`absolute -left-[4px] top-3 h-1.5 w-1.5 rounded-full ${done ? "bg-purple-400" : "bg-white/20"}`} /><div className="flex justify-between gap-3 text-[10px]"><span className="text-white/60">{label}</span><span className="text-white/25">{time}</span></div></div>;
}
