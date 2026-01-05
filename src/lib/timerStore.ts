import { writable } from "svelte/store";
import type * as Y from "yjs";

export interface TimerState {
    elapsed: number;
    startedAt: number | null;
    stoppedAt: number | null;
    countdown: number | null;
}

function createTimer() {
    const { subscribe, set, update } = writable<TimerState>({
        elapsed: 0,
        startedAt: null,
        stoppedAt: null,
        countdown: null
    });

    return {
        subscribe,
        set,
        reset: () => set({ elapsed: 0, startedAt: null, stoppedAt: null, countdown: null }),
        sync: (startedAt: number, stoppedAt: number | null = null) => {
            const now = Date.now();
            if (stoppedAt) {
                set({ 
                    startedAt, 
                    stoppedAt, 
                    elapsed: Math.floor((stoppedAt - startedAt) / 1000),
                    countdown: null
                });
            } else if (now < startedAt) {
                set({
                    startedAt,
                    stoppedAt: null,
                    elapsed: 0,
                    countdown: Math.ceil((startedAt - now) / 1000)
                });
            } else {
                set({ 
                    startedAt, 
                    stoppedAt: null, 
                    elapsed: Math.floor((now - startedAt) / 1000),
                    countdown: null
                });
            }
        },
        updateElapsed: () => update(s => {
            if (s.startedAt !== null && s.stoppedAt === null) {
                const now = Date.now();
                if (now < s.startedAt) {
                    return { ...s, elapsed: 0, countdown: Math.ceil((s.startedAt - now) / 1000) };
                }
                return { ...s, elapsed: Math.floor((now - s.startedAt) / 1000), countdown: null };
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
