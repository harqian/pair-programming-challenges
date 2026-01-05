<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { getPartySocket } from "$lib/partyContext";
    import { settings } from "$lib/settings";
    import { timer } from "$lib/timerStore";
    import Hamburger from "./Hamburger.svelte";

    const socket = getPartySocket();
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

    onMount(() => {
        // Start interval for local display updates
        interval = setInterval(updateElapsed, 1000);

        if (!socket) return;
        
        // Keep the socket for copy link or other things if needed
        // but timer is now handled via Yjs in +page.svelte
    });

    onDestroy(() => {
        if (interval) clearInterval(interval);
    });

    let { middle, theme = "dark" }: { middle?: import("svelte").Snippet, theme?: "dark" | "light" } = $props();

    async function copyRoomLink() {
        await navigator.clipboard.writeText(window.location.href);
        copied = true;
        setTimeout(() => (copied = false), 2000);
    }
</script>

<header>
    <h2>Pair Programming Challenge 👬</h2>
    {#if middle}
        {@render middle()}
    {/if}
    <div class="timer-section">
        <span class="timer">{formatTime($timer.elapsed)}</span>
    </div>
    <button class="copy-btn" onclick={copyRoomLink}>
        {copied ? "Copied!" : "Copy Link"}
    </button>
    <div class="settings-wrapper">
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
                            <div><kbd>⌘`</kbd> Terminal</div>
                            <div><kbd>⌘1</kbd> Editor</div>
                        </div>
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

    h2 {
        flex-grow: 1;
        font-weight: normal;
        margin: 0;
        font-size: 1rem;
        color: var(--term-text);
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
</style>
