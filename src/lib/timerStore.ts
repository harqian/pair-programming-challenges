import { writable } from "svelte/store";
import type * as Y from "yjs";

export interface TimerState {
    elapsed: number;
    startedAt: number | null;
    stoppedAt: number | null;
}

function createTimer() {
    const { subscribe, set, update } = writable<TimerState>({
        elapsed: 0,
        startedAt: null,
        stoppedAt: null
    });

    return {
        subscribe,
        set,
        reset: () => set({ elapsed: 0, startedAt: null, stoppedAt: null }),
        sync: (startedAt: number, stoppedAt: number | null = null) => {
            if (stoppedAt) {
                set({ 
                    startedAt, 
                    stoppedAt, 
                    elapsed: Math.floor((stoppedAt - startedAt) / 1000) 
                });
            } else {
                const elapsed = Math.floor((Date.now() - startedAt) / 1000);
                set({ startedAt, stoppedAt: null, elapsed });
            }
        },
        updateElapsed: () => update(s => {
            if (s.startedAt !== null && s.stoppedAt === null) {
                return { ...s, elapsed: Math.floor((Date.now() - s.startedAt) / 1000) };
            }
            return s;
        }),
        bindToYMap: (yMap: Y.Map<any>) => {
            const updateFromYMap = () => {
                const startedAt = yMap.get("startedAt") as number | undefined;
                const stoppedAt = yMap.get("stoppedAt") as number | undefined;
                
                if (startedAt) {
                    timer.sync(startedAt, stoppedAt || null);
                } else {
                    timer.reset();
                }
            };

            yMap.observe(updateFromYMap);
            updateFromYMap();
        }
    };
}

export const timer = createTimer();
