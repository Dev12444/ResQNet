"use client";

import { BellRing, X } from "lucide-react";

type Props = { count: number; onDismiss: () => void };

export default function AlertBanner({ count, onDismiss }: Props) {
  if (!count) return null;
  return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl border border-red-400/15 bg-red-500/[0.07] px-4 py-3 text-xs text-white shadow-lg shadow-red-950/10">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-300"><BellRing size={15} /></div>
      <div className="min-w-0 flex-1"><div className="font-semibold">{count} incident{count > 1 ? "s" : ""} need attention</div><div className="mt-0.5 text-[10px] text-white/40">A critical response is waiting for human approval.</div></div>
      <button type="button" onClick={onDismiss} className="grid h-7 w-7 place-items-center rounded-lg text-white/30 hover:bg-white/5 hover:text-white" aria-label="Dismiss alert"><X size={14} /></button>
    </div>
  );
}
