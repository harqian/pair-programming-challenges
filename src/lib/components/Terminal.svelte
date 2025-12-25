<script module lang="ts">
    if (!crypto.randomUUID) {
        crypto.randomUUID =
            function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
                // Use crypto.getRandomValues if available for better randomness
                if (crypto.getRandomValues) {
                    // Generate 16 random bytes
                    const bytes = new Uint8Array(16);
                    crypto.getRandomValues(bytes);

                    // Set version (4) and variant bits according to RFC4122
                    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
                    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

                    // Convert to UUID string format
                    const hex = Array.from(bytes, (byte) =>
                        byte.toString(16).padStart(2, "0"),
                    ).join("");
                    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
                }

                // Fallback to Math.random() (less secure)
                return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
                    /[xy]/g,
                    function (c) {
                        const r = (Math.random() * 16) | 0;
                        const v = c === "x" ? r : (r & 0x3) | 0x8;
                        return v.toString(16);
                    },
                ) as any;
            };
    }

    export class CommandContext {
        private session: CommandSession;
        private recomputeScroll: () => void;

        constructor(session: CommandSession, recomputeScroll?: () => void) {
            this.session = session;
            this.recomputeScroll = recomputeScroll || (() => {});
        }

        log(text: string, type: LogEntry["type"] = "info") {
            this.session.logs.push({ text, type, timestamp: new Date() });
            this.recomputeScroll();
        }

        info(text: string) {
            this.log(text, "info");
        }

        error(text: string) {
            this.log(text, "error");
        }

        success(text: string) {
            this.log(text, "success");
        }

        warning(text: string) {
            this.log(text, "warning");
        }

        complete() {
            this.session.status = "completed";
            this.recomputeScroll();
        }

        fail() {
            this.session.status = "error";
            this.recomputeScroll();
        }
    }
</script>

<script lang="ts">
    interface LogEntry {
        text: string;
        type: "info" | "error" | "success" | "warning";
        timestamp: Date;
    }

    interface CommandSession {
        id: string;
        command: string;
        timestamp: Date;
        logs: LogEntry[];
        status: "running" | "completed" | "error";
        collapsed: boolean;
    }

    interface Props {
        welcomeMessage?: string;
        onCommand?: (command: string, context: CommandContext) => void;
        maxHeight?: string;
    }

    let {
        welcomeMessage = "Terminal ready. Type a command to begin...",
        onCommand = () => {},
        maxHeight = "600px",
    }: Props = $props();

    let sessions = $state<CommandSession[]>([]);
    let inputValue = $state("");
    let terminalRef: HTMLDivElement | undefined = $state();
    let terminalContentRef: HTMLDivElement | undefined = $state();
    let inputRef: HTMLInputElement | undefined = $state();
    let commandHistory = $state<string[]>([]);
    let historyIndex = $state(-1);
    let isNearBottom = $state(true);

    const SCROLL_THRESHOLD = 150; // pixels from bottom

    // Show welcome message on mount
    $effect(() => {
        if (sessions.length === 0 && welcomeMessage) {
            const welcomeSession = $state({
                id: "welcome",
                command: "system",
                timestamp: new Date(),
                logs: [
                    {
                        text: welcomeMessage,
                        type: "info" as const,
                        timestamp: new Date(),
                    },
                ],
                status: "completed" as const,
                collapsed: false,
            });
            sessions.push(welcomeSession);
        }
    });

    function recomputeScroll() {
        if (!terminalContentRef) return;

        if (isNearBottom) {
            terminalContentRef.scrollTop = terminalContentRef.scrollHeight;
        }

        const { scrollTop, scrollHeight, clientHeight } = terminalContentRef;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        isNearBottom = distanceFromBottom < SCROLL_THRESHOLD;
    }

    function scrollToBottom() {
        if (!terminalContentRef) return;

        terminalContentRef.scrollTo({
            top: terminalContentRef.scrollHeight,
            behavior: "smooth",
        });

        // Immediately set isNearBottom to true to resume auto-scrolling
        isNearBottom = true;
    }

    function handleSubmit(e: Event) {
        e.preventDefault();
        const command = inputValue.trim();
        if (!command) return;

        // Add to history
        commandHistory.push(command);
        historyIndex = -1;

        // Create new session with reactive properties
        const session = $state({
            id: crypto.randomUUID(),
            command,
            timestamp: new Date(),
            logs: [] as LogEntry[],
            status: "running" as "running" | "completed" | "error",
            collapsed: false,
        });

        sessions.push(session);

        // Create context without updateFn
        const context = new CommandContext(session, recomputeScroll);

        // Clear input immediately
        inputValue = "";

        // Execute command asynchronously
        onCommand(command, context);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (commandHistory.length === 0) return;
            if (historyIndex === -1) {
                historyIndex = commandHistory.length - 1;
            } else if (historyIndex > 0) {
                historyIndex--;
            }
            inputValue = commandHistory[historyIndex] || "";
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (historyIndex === -1) return;
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                inputValue = commandHistory[historyIndex] || "";
            } else {
                historyIndex = -1;
                inputValue = "";
            }
        }
    }

    function toggleCollapse(sessionId: string) {
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
            session.collapsed = !session.collapsed;
        }
    }

    function focusInput() {
        inputRef?.focus();
    }

    function formatTime(date: Date): string {
        return date.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }
</script>

<div
    class="terminal-container"
    style="max-height: {maxHeight}"
    bind:this={terminalRef}
    onclick={focusInput}
>
    <div
        class="terminal-content"
        bind:this={terminalContentRef}
        onscroll={recomputeScroll}
    >
        {#each sessions as session (session.id)}
            <div class="command-session" class:collapsed={session.collapsed}>
                {#if session.command !== "system"}
                    <div
                        class="command-header"
                        onclick={() => toggleCollapse(session.id)}
                        role="button"
                        tabindex="0"
                        onkeydown={(e) =>
                            e.key === "Enter" && toggleCollapse(session.id)}
                    >
                        <div class="command-info">
                            <span
                                class="status-icon"
                                class:running={session.status === "running"}
                                class:error={session.status === "error"}
                                class:completed={session.status === "completed"}
                            >
                                {#if session.status === "running"}
                                    <span class="spinner"></span>
                                {:else if session.status === "error"}
                                    !
                                {:else}
                                    &gt;
                                {/if}
                            </span>
                            <span class="command-text">{session.command}</span>
                            <span class="timestamp"
                                >[{formatTime(session.timestamp)}]</span
                            >
                        </div>
                        <span class="collapse-icon">
                            {session.collapsed ? "+" : "-"}
                        </span>
                    </div>
                {/if}

                {#if !session.collapsed}
                    <div class="logs-container">
                        {#each session.logs as log}
                            <div class="log-line {log.type}">
                                <span class="log-marker">
                                    {#if log.type === "error"}
                                        [ERR]
                                    {:else if log.type === "success"}
                                        [OK]
                                    {:else if log.type === "warning"}
                                        [WARN]
                                    {:else}
                                        [INFO]
                                    {/if}
                                </span>
                                <span class="log-text">{log.text}</span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    {#if !isNearBottom}
        <button
            class="scroll-to-bottom"
            onclick={scrollToBottom}
            aria-label="Scroll to bottom"
        >
            <span>v NEW DATA v</span>
        </button>
    {/if}

    <form onsubmit={handleSubmit} class="input-area">
        <span class="prompt">&gt;_</span>
        <input
            bind:this={inputRef}
            bind:value={inputValue}
            onkeydown={handleKeyDown}
            type="text"
            autocomplete="off"
            spellcheck="false"
            class="terminal-input"
            aria-label="Terminal Input"
        />
        <span class="cursor-block"></span>
    </form>
</div>

<style>
    /* Theme Variables */
    :root {
        --term-bg: #0c0c0c;
        --term-session-bg: #000000;
        --term-border: #333333;
        --term-text: #cccccc;
        --term-green: #00ff41;
        --term-cyan: #00ffff;
        --term-red: #ff3333;
        --term-yellow: #ffff00;
        --term-font: "Consolas", "Monaco", "Courier New", monospace;
    }

    .terminal-container {
        background-color: var(--term-bg);
        color: var(--term-text);
        font-family: var(--term-font);
        border: 2px solid var(--term-border);
        border-radius: 0; /* Strict Rectangle */
        display: flex;
        flex-direction: column;
        height: 100%;
        position: relative;
        /* Crisp edges */
        box-shadow: 4px 4px 0px #000000;
    }

    .terminal-content {
        flex: 1;
        overflow-y: auto;
        padding: 0;
        scrollbar-width: thin;
        scrollbar-color: var(--term-border) var(--term-bg);
    }

    /* Square Scrollbar for Webkit */
    .terminal-content::-webkit-scrollbar {
        width: 12px;
    }

    .terminal-content::-webkit-scrollbar-track {
        background: var(--term-bg);
        border-left: 1px solid var(--term-border);
    }

    .terminal-content::-webkit-scrollbar-thumb {
        background: var(--term-border);
        border-radius: 0;
        border: 2px solid var(--term-bg);
    }

    .terminal-content::-webkit-scrollbar-thumb:hover {
        background: #555;
    }

    .command-session {
        border-bottom: 1px solid var(--term-border);
        background: var(--term-session-bg);
        transition: none; /* Remove smooth transitions */
    }

    .command-session:hover {
        background: #111;
    }

    .command-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1rem;
        cursor: pointer;
        user-select: none;
    }

    .command-header:hover .command-text {
        text-decoration: underline;
    }

    .command-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
    }

    .status-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        font-weight: bold;
        border-radius: 0; /* Rectangle */
        font-size: 14px;
    }

    .status-icon.running {
        color: var(--term-cyan);
    }
    .status-icon.completed {
        color: var(--term-green);
    }
    .status-icon.error {
        color: var(--term-red);
    }

    /* Block Spinner */
    .spinner {
        display: inline-block;
        width: 8px;
        height: 8px;
        background-color: var(--term-cyan);
        animation: blink 0.5s step-end infinite;
    }

    @keyframes blink {
        50% {
            opacity: 0;
        }
    }

    .command-text {
        color: #ffffff;
        font-weight: 700;
    }

    .timestamp {
        color: #555;
        font-size: 0.75rem;
        margin-left: auto;
        margin-right: 1rem;
    }

    .collapse-icon {
        color: var(--term-text);
        font-family: monospace;
        font-weight: bold;
    }

    .logs-container {
        padding: 0.5rem 1rem 1rem 1rem;
        border-top: 1px dashed #222;
        background-color: #080808;
    }

    .log-line {
        margin-bottom: 0.25rem;
        line-height: 1.4;
        font-size: 0.9rem;
        display: flex;
        gap: 0.75rem;
    }

    .log-marker {
        font-weight: bold;
        min-width: 60px;
    }

    .log-line.info {
        color: var(--term-text);
    }
    .log-line.info .log-marker {
        color: #666;
    }

    .log-line.success {
        color: var(--term-green);
    }
    .log-line.success .log-marker {
        color: var(--term-green);
    }

    .log-line.error {
        color: var(--term-red);
    }
    .log-line.error .log-marker {
        color: var(--term-red);
    }

    .log-line.warning {
        color: var(--term-yellow);
    }
    .log-line.warning .log-marker {
        color: var(--term-yellow);
    }

    .scroll-to-bottom {
        position: absolute;
        bottom: 50px;
        right: 20px;
        padding: 4px 12px;
        background: var(--term-bg);
        color: var(--term-green);
        border: 1px solid var(--term-green);
        border-radius: 0;
        font-family: var(--term-font);
        font-size: 0.75rem;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 2px 2px 0 #000;
        z-index: 10;
    }

    .scroll-to-bottom:hover {
        background: var(--term-green);
        color: #000;
        transform: translate(1px, 1px);
        box-shadow: 1px 1px 0 #000;
    }

    .input-area {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: var(--term-bg);
        border-top: 2px solid var(--term-border);
    }

    .prompt {
        color: var(--term-green);
        font-weight: bold;
        user-select: none;
    }

    .terminal-input {
        flex: 1;
        background: transparent;
        border: none;
        color: #fff;
        font-family: inherit;
        font-size: 1rem;
        outline: none;
        padding: 0;
        margin: 0;
        caret-color: var(--term-green);
    }
</style>
