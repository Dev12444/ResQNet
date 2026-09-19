"use client";

/**
 * One hook for every FE2 data load, so loading / empty / error / offline /
 * partial-data states are handled the same way on every page instead of being
 * reinvented per screen.
 *
 * It keeps the previous payload while refetching: a panel that blanks out on
 * every poll is useless in an operations room.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { DataMode, Envelope } from "@/types";

export interface EnvelopeState<T> {
  data: T | null;
  mode: DataMode;
  /** True only on the very first load, when there is nothing to show yet. */
  loading: boolean;
  /** True while a background refresh is in flight over existing data. */
  refreshing: boolean;
  /** Set when the live call failed. Data may still be present (cached/mock). */
  error: string | null;
  fetchedAt: string | null;
  reload: () => void;
}

export function useEnvelope<T>(
  load: () => Promise<Envelope<T>>,
  deps: React.DependencyList = [],
): EnvelopeState<T> {
  const [state, setState] = useState<{
    data: T | null;
    mode: DataMode;
    error: string | null;
    fetchedAt: string | null;
  }>({ data: null, mode: "simulated", error: null, fetchedAt: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const hasData = state.data !== null;
  // Keep the latest loader without making it a dependency of the effect.
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (isFirst: boolean) => {
    if (isFirst) setLoading(true);
    else setRefreshing(true);
    try {
      const env = await loadRef.current();
      setState({
        data: env.data,
        mode: env.mode,
        error: env.error,
        fetchedAt: env.fetched_at,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to load",
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await run(!hasData);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  return {
    ...state,
    loading,
    refreshing,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}
