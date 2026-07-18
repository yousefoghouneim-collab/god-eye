import type { BusEventType } from '@god-eye/shared';

type BusCallback = (payload: unknown) => void;

const listeners = new Map<string, Set<BusCallback>>();

export const DataBus = {
  on(event: BusEventType | string, cb: BusCallback) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(cb);
    return () => listeners.get(event)?.delete(cb);
  },

  emit(event: BusEventType | string, payload: unknown) {
    const cbs = listeners.get(event);
    if (cbs) for (const cb of cbs) cb(payload);
  },

  off(event: BusEventType | string, cb: BusCallback) {
    listeners.get(event)?.delete(cb);
  },
};
