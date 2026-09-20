'use client';
import { pageStrings } from "@/lib/pageStrings";
import { useLang } from "@/components/layout/LangProvider";
import { AlertTriangle, Check, Hospital, Loader2, RefreshCw, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getRecommendations } from '@/lib/api';
import { dispatchIncident } from '@/lib/command';
import type { DataMode, RecommendationsResponse } from '@/types';

const label = (k: string) => k.replace(/_/g, ' ');

/** AI unit recommendations for one incident: suggested units pre-ticked, dispatcher approves. */
export function RecommendationPanel({ incidentId, version, dispatched, onDispatched }: {
  incidentId: number; version: number; dispatched: boolean; onDispatched: () => void;
}) {
  const { lang } = useLang();
  const t = pageStrings(lang).recommendation;
  const [rec, setRec] = useState<RecommendationsResponse | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  // Provenance of what is on screen. Without it a failed call left this panel
  // spinning "{t.ranking}" indefinitely, which reads as "the AI is thinking"
  // rather than "the AI never answered".
  const [mode, setMode] = useState<DataMode | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => { setMode(null); setAttempt((n) => n + 1); }, []);

  // One loader for both the first fetch and the refresh that follows a
  // dispatch elsewhere. `keepTicks` is what stops a background refresh from
  // wiping a selection the dispatcher has already made.
  useEffect(() => {
    let alive = true;
    const keepTicks = rec !== null;
    getRecommendations(incidentId).then((env) => {
      if (!alive) return;
      setRec(env.data);
      setMode(env.mode);
      setNote(env.error);
      if (!keepTicks) setSelected(env.data?.suggested_resource_ids ?? []);
    });
    return () => { alive = false; };
    // `rec` is read for keepTicks but must not retrigger the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId, version, attempt]);

  if (!rec && mode === null) return <div style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}><Loader2 size={12} className="spin" /> {t.ranking}</div>;

  // The recommender returned nothing and there is no cached answer. Say so,
  // and leave a way to ask again — the API sleeps, and the retry usually wins.
  if (!rec) return <div style={{ padding: '9px 10px', borderRadius: 6, background: 'var(--soft-bg)', border: '1px solid var(--line-strong)' }}>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, fontWeight: 800, color: 'var(--danger-text)' }}><AlertTriangle size={12} /> {t.none}</div>
    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>{note ?? t.noAnswer}</div>
    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>{t.noneNote}</div>
    <button type="button" onClick={retry} style={{ marginTop: 8, display: 'flex', gap: 5, alignItems: 'center', padding: '5px 9px', borderRadius: 5, border: '1px solid var(--line-strong)', background: 'var(--input)', color: 'var(--body-text)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}><RefreshCw size={11} /> {t.tryAgain}</button>
  </div>;
  if (dispatched && state !== 'sent') return <div style={{ fontSize: 10, color: 'var(--accent)', display: 'flex', gap: 6, alignItems: 'center' }}><Check size={13} /> {t.dispatched}</div>;

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const approve = async () => {
    setState('sending');
    setError('');
    try {
      await dispatchIncident(incidentId, selected, rec.facility?.facility.id ?? null);
      setState('sent');
      onDispatched();
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : t.failed);
    }
  };

  return <div>
    {mode !== null && mode !== 'live' && <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '6px 8px', marginBottom: 8, borderRadius: 6, background: 'var(--soft-bg)', border: '1px solid var(--line-strong)', fontSize: 9, color: 'var(--muted)', lineHeight: 1.5 }}>
      <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
      <span><b style={{ color: 'var(--body-text)' }}>{mode === 'simulated' ? t.demoRanking : t.notLive}</b> — {note ?? (mode === 'simulated' ? t.demoNote : t.staleNote)} {t.confirm}</span>
    </div>}
    {rec.shortages.length > 0 && <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '7px 8px', marginBottom: 8, borderRadius: 6, background: 'var(--danger-soft)', color: 'var(--danger-text)', fontSize: 9, fontWeight: 800 }}><AlertTriangle size={12} /> NO AVAILABLE {rec.shortages.map(label).join(', ').toUpperCase()}</div>}
    {rec.needed_kinds.map((kind) => {
      const units = rec.recommendations[kind] ?? [];
      if (!units.length) return null;
      return <div key={kind} style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 1, color: 'var(--muted)', margin: '8px 0 5px' }}>{label(kind).toUpperCase()}</div>
        {units.map((r) => {
          const on = selected.includes(r.resource.id);
          return <button key={r.resource.id} onClick={() => toggle(r.resource.id)} disabled={state === 'sent'} style={{ width: '100%', display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 8, alignItems: 'center', textAlign: 'left', padding: '9px 8px', marginBottom: 5, borderRadius: 6, border: on ? '1px solid var(--accent-border)' : '1px solid var(--line-strong)', background: on ? 'var(--selected-bg)' : 'var(--input)', color: 'var(--text)' }}>
            <span style={{ width: 17, height: 17, borderRadius: 4, border: on ? '1px solid var(--accent)' : '1px solid var(--line-strong)', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>{on && <Check size={11} />}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800 }}>{r.resource.callsign} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {r.resource.base ?? label(r.kind)}</span></div>
              {!!r.matched_capabilities?.length && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>{r.matched_capabilities.map((c) => <span key={c} style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 4, background: 'var(--soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>{label(c)}</span>)}</div>}
              <div style={{ fontSize: 8.5, color: 'var(--muted)', marginTop: 4 }}>{r.reason}</div>
            </div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 800 }}>{r.eta_min} min</div><div style={{ fontSize: 8, color: 'var(--muted)' }}>{r.distance_km} km</div></div>
          </button>;
        })}
      </div>;
    })}
    {rec.facility && <div style={{ padding: 9, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--input)', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 800 }}><Hospital size={12} color="var(--accent)" /> {rec.facility.facility.kind === 'shelter' ? 'RELIEF SHELTER' : 'RECEIVING HOSPITAL'}</div>
      <div style={{ fontSize: 10, fontWeight: 700, marginTop: 6 }}>{rec.facility.facility.name}</div>
      <div style={{ fontSize: 8.5, color: 'var(--muted)', marginTop: 2 }}>{rec.facility.reason} · {rec.facility.distance_km} km</div>
    </div>}
    <button disabled={!selected.length || state === 'sending' || state === 'sent'} onClick={approve} style={{ width: '100%', height: 34, marginTop: 8, borderRadius: 6, border: '1px solid var(--accent-border)', background: state === 'sent' ? 'var(--action-bg)' : 'var(--action-strong)', color: 'var(--text)', fontSize: 9, fontWeight: 900, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, opacity: (!selected.length && state !== 'sent') ? .45 : 1 }}>
      {state === 'sent' ? <><Check size={13} /> {t.approved}</> : state === 'sending' ? <><Loader2 size={13} className="spin" /> {t.dispatching}</> : <><Send size={13} /> APPROVE DISPATCH ({selected.length})</>}
    </button>
    {state === 'error' && <div style={{ marginTop: 6, fontSize: 9, color: 'var(--danger-text)' }}>{error}</div>}
    <div style={{ marginTop: 6, textAlign: 'center', fontSize: 8, color: 'var(--muted)' }}>{t.aiRecommends}</div>
  </div>;
}
