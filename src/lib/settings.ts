import { writable } from "svelte/store";
import { browser } from "$app/environment";

function createSettings() {
    const defaults = { fontSize: 14, theme: "dark" as "dark" | "light", shortcuts: true, terminalHeight: 200 };

    const stored = browser ? localStorage.getItem("settings") : null;
    const initial = stored ? { ...defaults, ...JSON.parse(stored) } : defaults;

    const { subscribe, update } = writable(initial);

    const save = (next: typeof initial) => {
        if (browser) localStorage.setItem("settings", JSON.stringify(next));
        return next;
    };

    return {
        subscribe,
        setFontSize: (size: number) => update(s => save({ ...s, fontSize: size })),
        setTerminalHeight: (height: number) => update(s => save({ ...s, terminalHeight: height })),
        toggleTheme: () => update(s => save({ ...s, theme: s.theme === "dark" ? "light" : "dark" })),
        toggleShortcuts: () => update(s => save({ ...s, shortcuts: !s.shortcuts })),
    };
}

export const settings = createSettings();
