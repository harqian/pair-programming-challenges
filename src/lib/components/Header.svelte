<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { getPartySocket, getYjsProvider } from "$lib/partyContext";
    import { settings } from "$lib/settings";
    import { timer } from "$lib/timerStore";
    import Hamburger from "./Hamburger.svelte";

    const socket = getPartySocket();
    const provider = getYjsProvider();
    const awareness = provider?.awareness;

    type User = { name: string; color: string; clientId: number };
    let connectedUsers: User[] = $state([]);
    let copied = $state(false);

    let interval: number | undefined = undefined;
    let open = $state(false);

    function updateElapsed() {
        timer.updateElapsed();
    }

    function startTimer() {
        if (!socket) return;
        socket.send(
            JSON.stringify({
                type: "startTimer",
                clientTime: Date.now(),
            }),
        );
    }

    function resetTimer() {
        if (!socket) return;
        socket.send(
            JSON.stringify({
                type: "resetTimer",
            }),
        );
    }

    function formatTime(seconds: number): string {
        if ($timer.countdown !== null) return "Ready?";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }

    function updateUsers() {
        if (!awareness) return;
        const states = awareness.getStates();
        const users: User[] = [];
        states.forEach((state, clientId) => {
            if (state.user?.name && state.user?.color) {
                users.push({ name: state.user.name, color: state.user.color, clientId });
            }
        });
        connectedUsers = users;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape" && open) {
            open = false;
        }
    }

    onMount(() => {
        interval = setInterval(updateElapsed, 1000);

        if (awareness) {
            awareness.on("change", updateUsers);
            updateUsers();
        }

        document.addEventListener("keydown", handleKeydown);
    });

    onDestroy(() => {
        if (interval) clearInterval(interval);
        if (awareness) {
            awareness.off("change", updateUsers);
        }
        document.removeEventListener("keydown", handleKeydown);
    });

    let {
        middle,
        theme = "dark",
        onShowTutorial,
    }: {
        middle?: import("svelte").Snippet;
        theme?: "dark" | "light";
        onShowTutorial?: () => void;
    } = $props();

    async function copyRoomLink() {
        await navigator.clipboard.writeText(window.location.href);
        copied = true;
        setTimeout(() => (copied = false), 2000);
    }

    function getContrastColor(color: string): string {
        if (!color || typeof color !== 'string') return '#fff';
        let r, g, b;
        if (color.startsWith('#')) {
            const c = color.replace('#', '');
            r = parseInt(c.slice(0, 2), 16);
            g = parseInt(c.slice(2, 4), 16);
            b = parseInt(c.slice(4, 6), 16);
        } else {
            const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                r = parseInt(match[1]);
                g = parseInt(match[2]);
                b = parseInt(match[3]);
            } else {
                return '#fff';
            }
        }
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const result = luminance > 0.5 ? '#000000' : '#ffffff';
        return result;
    }
</script>

<header>
    <a href="/" class="home-btn" title="Back to Home">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    </a>
    <h2>debuff.dev</h2>
    <div class="connected-users">
        {#each connectedUsers as user (user.clientId)}
            <span class="user-badge" style="background-color: {user.color}; color: {getContrastColor(user.color)} !important;">{user.name}</span>
        {/each}
    </div>
    {#if middle}
        {@render middle()}
    {/if}
    <div class="timer-section">
        <span class="timer">{formatTime($timer.elapsed)}</span>
    </div>
    <button class="copy-btn" onclick={copyRoomLink}>
        {copied ? "Copied!" : "Copy Link"}
    </button>
    <div id="settings-menu" class="settings-wrapper">
        <Hamburger
            {open}
            duoLine={false}
            on:click={() => (open = !open)}
        />
        {#if open}
            <div class="settings-panel">
                <div class="setting-row">
                    <span>Font Size</span>
                    <div class="font-controls">
                        <button onclick={() => settings.setFontSize($settings.fontSize - 1)}>-</button>
                        <span>{$settings.fontSize}</span>
                        <button onclick={() => settings.setFontSize($settings.fontSize + 1)}>+</button>
                    </div>
                </div>
                <div class="setting-row">
                    <span>Show Cursors</span>
                    <button onclick={() => settings.toggleCursors()}>
                        {$settings.showCursors ? "✓ On" : "✗ Off"}
                    </button>
                </div>
                <div class="setting-row">
                    <span>Theme</span>
                    <button onclick={() => settings.toggleTheme()}>
                        {$settings.theme === "dark" ? "🌙 Dark" : "☀️ Light"}
                    </button>
                </div>
                <div class="setting-row">
                    <span>Shortcuts</span>
                    <button onclick={() => settings.toggleShortcuts()}>
                        {$settings.shortcuts ? "✓ On" : "✗ Off"}
                    </button>
                </div>
                {#if $settings.shortcuts}
                <div class="setting-row shortcuts">
                    <div class="shortcut-list">
                        <div><kbd>^`</kbd> Terminal</div>
                        <div><kbd>⌘1</kbd> Editor</div>
                    </div>
                </div>
                {/if}
                <div class="setting-row reset-row">
                    <button class="reset-settings-btn" onclick={() => settings.reset()}>
                        Reset to Defaults
                    </button>
                </div>
                {#if onShowTutorial}
                    <div class="setting-row">
                        <span>Tutorial</span>
                        <button onclick={() => { open = false; onShowTutorial(); }}>
                            Show
                        </button>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</header>

<style>
    header {
        height: 40px;
        display: flex;
        align-items: center;
        font-family: var(--term-font);
        padding: 10px 20px;
        background: var(--term-bg);
        border-bottom: 2px solid var(--term-border);
        gap: 20px;
    }

    .home-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--term-text);
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .home-btn:hover {
        background: var(--term-border);
    }

    h2 {
        font-weight: normal;
        margin: 0;
        font-size: 1rem;
        color: var(--term-text);
    }

    .connected-users {
        display: flex;
        gap: 6px;
        flex-grow: 1;
    }

    .user-badge {
        padding: 2px 8px;
        font-size: 0.75rem;
        font-weight: bold;
        white-space: nowrap;
    }

    .timer-section {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .timer {
        font-size: 1.2rem;
        font-weight: bold;
        color: var(--term-green);
        min-width: 60px;
    }

    button {
        background: transparent;
        border: 1px solid var(--term-border);
        color: var(--term-text);
        font-family: var(--term-font);
        padding: 4px 12px;
        cursor: pointer;
        font-size: 0.85rem;
    }

    button:hover {
        background: var(--term-border);
    }

    .copy-btn {
        background: var(--term-green);
        color: var(--term-bg);
        border: none;
    }

    .copy-btn:hover {
        opacity: 0.8;
    }

    .settings-wrapper {
        position: relative;
    }

    .settings-panel {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        background: var(--term-bg);
        border: 1px solid var(--term-border);
        padding: 12px;
        min-width: 200px;
        z-index: 1000;
    }

    .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--term-border);
    }

    .setting-row:last-child {
        border-bottom: none;
    }

    .font-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .font-controls button {
        width: 24px;
        height: 24px;
        padding: 0;
    }

    .shortcuts {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }

    .shortcut-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.85rem;
    }

    .shortcut-list div {
        display: flex;
        gap: 8px;
    }

    kbd {
        background: var(--term-border);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: var(--term-font);
        font-size: 0.8rem;
    }

    .reset-row {
        justify-content: center;
        padding-top: 12px;
    }

    .reset-settings-btn {
        width: 100%;
        background: var(--term-red);
        color: white;
        border: none;
        padding: 6px;
        font-weight: bold;
    }

    .reset-settings-btn:hover {
        opacity: 0.9;
        background: var(--term-red);
    }
</style>
