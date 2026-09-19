"use client";

/**
 * Live data for the command center: incidents, units, facilities and alerts from the API (mock
 * fallback via lib/api), refreshed on every WebSocket event and by a slow poll as a safety net.
 * Also owns the selected incident (auto-selects the most urgent one on first load).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getAlerts, getFacilities, getIncident, getIncidents, getResources } from "@/lib/api";
import { createResQWebSocket } from "@/lib/ws";
import type { Alert, DataMode, Facility, Incident, IncidentDetail, Resource } from "@/types";
import { byUrgency } from "./view";

const POLL_MS = 15_000;
const WS_DEBOUNCE_MS = 400;

export function useCommandCenter() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [mode, setMode] = useState<DataMode>("simulated");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0); // bumps on every refresh so panels can refetch
  const [selectedId, setSelected] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const userCleared = useRef(false);

  const loadDetail = useCallback(async (id: number) => {
    const d = await getIncident(id);
    if (selectedRef.current === id) setDetail(d.data);
  }, []);

  const select = useCallback(
    (id: number | null) => {
      selectedRef.current = id;
      userCleared.current = id == null;
      setSelected(id);
      if (id != null) void loadDetail(id);
    },
    [loadDetail],
  );

  const refresh = useCallback(async () => {
    const [inc, res, fac, al] = await Promise.all([getIncidents(), getResources(), getFacilities(), getAlerts()]);
    setIncidents(inc.data);
    setResources(res.data);
    setFacilities(fac.data);
    setAlerts(al.data);
    setMode(inc.mode);
    setError(inc.error);
    setLoaded(true);
    setVersion((v) => v + 1);
    if (selectedRef.current == null && !userCleared.current && inc.data.length) {
      const first = [...inc.data].sort(byUrgency)[0].id;
      selectedRef.current = first;
      setSelected(first);
    }
    if (selectedRef.current != null) await loadDetail(selectedRef.current);
  }, [loadDetail]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => void refresh(), POLL_MS);
    let pending: ReturnType<typeof setTimeout> | null = null;
    const stop = createResQWebSocket(
      () => {
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => void refresh(), WS_DEBOUNCE_MS); // a merge storm = one reload
      },
      setLive,
    );
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      if (pending) clearTimeout(pending);
      stop();
    };
  }, [refresh]);

  return {
    incidents, resources, facilities, alerts, mode, error, live, loaded, version, refresh,
    selectedId, select,
    detail: detail && detail.id === selectedId ? detail : null,
  };
}
