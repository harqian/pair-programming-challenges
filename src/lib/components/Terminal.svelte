<script module lang="ts">
    import type * as Y from "yjs";
    import type { Awareness } from "y-protocols/awareness";

    if (!crypto.randomUUID) {
        crypto.randomUUID =
            function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
                if (crypto.getRandomValues) {
                    const bytes = new Uint8Array(16);
                    crypto.getRandomValues(bytes);
                    bytes[6] = (bytes[6] & 0x0f) | 0x40;
                    bytes[8] = (bytes[8] & 0x3f) | 0x80;
                    const hex = Array.from(bytes, (byte) =>
                        byte.toString(16).padStart(2, "0"),
                    ).join("");
                    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
                }
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

    export interface LogEntry {
        text: string;
        type: "info" | "error" | "success" | "warning";
        timestamp: number;
    }

    export interface CommandSession {
        id: string;
        command: string;
        timestamp: number;
        logs: LogEntry[];
        status: "running" | "completed" | "error";
        ownerId: number; // awareness clientId of the owner
    }

    export class CommandContext {
        private sessionId: string;
        private yArray: Y.Array<CommandSession>;
        private autoScroll: () => void;
        private killCallback: (() => void) | undefined;
        private isAlive: boolean = true;

        constructor(
            sessionId: string,
            yArray: Y.Array<CommandSession>,
            autoScroll?: () => void,
        ) {
            this.sessionId = sessionId;
            this.yArray = yArray;
            this.autoScroll = autoScroll || (() => {});
        }

        private updateSession(
            updater: (session: CommandSession) => CommandSession,
        ) {
            const arr = this.yArray.toArray();
            const index = arr.findIndex((s) => s.id === this.sessionId);
            if (index === -1) return;

            const session = arr[index];

            // If the session is no longer running in the shared state, mark dead locally
            if (session.status !== "running" && this.isAlive) {
                this.isAlive = false;
            }

            const updated = updater({ ...session, logs: [...session.logs] });

            this.yArray.doc?.transact(() => {
                this.yArray.delete(index, 1);
                this.yArray.insert(index, [updated]);
            });

            this.autoScroll();
        }

        log(text: string, type: LogEntry["type"] = "info") {
            this.updateSession((session) => {
                session.logs.push({ text, type, timestamp: Date.now() });
                return session;
            });
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

        onceKilled(callback: () => void) {
            this.killCallback = callback;
        }

        kill() {
            if (!this.isAlive) return;

            this.log("^C", "error");

            if (this.killCallback) {
                try {
                    this.killCallback();
                } catch (e) {
                    console.error("Error in kill callback", e);
                }
            }

            this.fail();
        }

        complete() {
            if (!this.isAlive) return;
            this.isAlive = false;
            this.updateSession((session) => {
                session.status = "completed";
                return session;
            });
        }

        fail() {
            if (!this.isAlive) return;
            this.isAlive = false;
            this.updateSession((session) => {
                session.status = "error";
                return session;
            });
        }
    }
</script>

<script lang="ts">
    import { onDestroy, untrack } from "svelte";

    interface Props {
        welcomeMessage?: string;
        onCommand?: (command: string, context: CommandContext) => void;
        maxHeight?: string;
        yArray?: Y.Array<CommandSession>;
        awareness?: Awareness;
    }

    let {
        welcomeMessage = "Terminal ready. Type a command to begin...",
        onCommand = () => {},
        maxHeight = "600px",
        yArray,
        awareness,
    }: Props = $props();

    let sessions = $state<CommandSession[]>([]);
    let inputValue = $state("");
    let terminalRef: HTMLDivElement | undefined = $state();
    let terminalContentRef: HTMLDivElement | undefined = $state();
    let inputRef: HTMLInputElement | undefined = $state();
    let commandHistory = $state<string[]>([]);
    let historyIndex = $state(-1);
    let isNearBottom = $state(true);
    let collapsedSessions = $state<Set<string>>(new Set());

    // Track the current active context to handle Ctrl+C
    let activeCommandContext = $state<CommandContext | any | null>(null);

    const SCROLL_THRESHOLD = 10;

    // Track connected client IDs
    let connectedClients = $state<Set<number>>(new Set());

    // Track if we've initialized with yArray
    let initializedWithYArray = false;
    let currentYArray: Y.Array<CommandSession> | undefined;
    let currentAwareness: Awareness | undefined;

    // Sync sessions from yArray
    function syncFromYArray() {
        if (!currentYArray) return;
        sessions = currentYArray.toArray();
        autoScrollIfNeeded();
    }

    // Handle awareness changes to detect disconnections
    function handleAwarenessChange() {
        if (!currentAwareness || !currentYArray) return;

        const states = currentAwareness.getStates();
        const newConnectedClients = new Set<number>();

        states.forEach((_, clientId) => {
            newConnectedClients.add(clientId);
        });

        // Find clients that disconnected
        const disconnectedClients = [...connectedClients].filter(
            (id) => !newConnectedClients.has(id),
        );

        // Mark running sessions owned by disconnected clients as errored
        if (disconnectedClients.length > 0) {
            const arr = currentYArray.toArray();
            const updates: { index: number; session: CommandSession }[] = [];

            arr.forEach((session, index) => {
                if (
                    session.status === "running" &&
                    disconnectedClients.includes(session.ownerId)
                ) {
                    updates.push({
                        index,
                        session: {
                            ...session,
                            status: "error",
                            logs: [
                                ...session.logs,
                                {
                                    text: "disconnected",
                                    type: "error",
                                    timestamp: Date.now(),
                                },
                            ],
                        },
                    });
                }
            });

            if (updates.length > 0) {
                currentYArray.doc?.transact(() => {
                    // Process in reverse to maintain correct indices
                    for (let i = updates.length - 1; i >= 0; i--) {
                        const { index, session } = updates[i];
                        currentYArray!.delete(index, 1);
                        currentYArray!.insert(index, [session]);
                    }
                });
            }
        }

        connectedClients = newConnectedClients;
    }

    // React to yArray prop changes
    $effect(() => {
        // Capture the props we're reacting to
        const newYArray = yArray;
        const newAwareness = awareness;

        // Use untrack for all side effects to prevent infinite loops
        untrack(() => {
            // Clean up previous subscriptions
            if (currentYArray && currentYArray !== newYArray) {
                currentYArray.unobserve(syncFromYArray);
            }
            if (currentAwareness && currentAwareness !== newAwareness) {
                currentAwareness.off("change", handleAwarenessChange);
            }

            currentYArray = newYArray;
            currentAwareness = newAwareness;

            if (!newYArray) {
                // Non-yjs mode: show welcome message locally if not already shown
                if (
                    !initializedWithYArray &&
                    sessions.length === 0 &&
                    welcomeMessage
                ) {
                    sessions = [
                        {
                            id: "welcome",
                            command: "system",
                            timestamp: Date.now(),
                            logs: [
                                {
                                    text: welcomeMessage,
                                    type: "info",
                                    timestamp: Date.now(),
                                },
                            ],
                            status: "completed",
                            ownerId: -1,
                        },
                    ];
                }
                return;
            }

            initializedWithYArray = true;

            // Initialize from yArray
            sessions = newYArray.toArray();

            // Listen to yArray changes
            newYArray.observe(syncFromYArray);

            // Listen to awareness changes
            if (newAwareness) {
                handleAwarenessChange();
                newAwareness.on("change", handleAwarenessChange);
            }
        });
    });

    onDestroy(() => {
        if (currentYArray) {
            currentYArray.unobserve(syncFromYArray);
        }
        if (currentAwareness) {
            currentAwareness.off("change", handleAwarenessChange);
        }
    });

    function handleScroll() {
        if (!terminalContentRef) return;
        const { scrollTop, scrollHeight, clientHeight } = terminalContentRef;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        isNearBottom = distanceFromBottom < SCROLL_THRESHOLD;
    }

    function autoScrollIfNeeded() {
        requestAnimationFrame(() => {
            if (!terminalContentRef) return;
            if (isNearBottom) {
                terminalContentRef.scrollTop = terminalContentRef.scrollHeight;
            }
            handleScroll();
        });
    }

    function scrollToBottom() {
        if (!terminalContentRef) return;
        terminalContentRef.scrollTo({
            top: terminalContentRef.scrollHeight,
            behavior: "smooth",
        });
        isNearBottom = true;
    }

    function handleSubmit(e: Event) {
        e.preventDefault();
        const command = inputValue.trim();
        if (!command) return;

        commandHistory.push(command);
        historyIndex = -1;

        const sessionId = crypto.randomUUID();
        const ownerId = awareness?.clientID ?? -1;

        const newSession: CommandSession = {
            id: sessionId,
            command,
            timestamp: Date.now(),
            logs: [],
            status: "running",
            ownerId,
        };

        if (yArray) {
            yArray.push([newSession]);
            const context = new CommandContext(
                sessionId,
                yArray,
                autoScrollIfNeeded,
            );

            // Set active context for Ctrl+C
            activeCommandContext = context;

            inputValue = "";
            onCommand(command, context);
        } else {
            // Fallback for non-yjs mode
            sessions = [...sessions, newSession];
            inputValue = "";

            let killCallback: (() => void) | undefined;
            let isAlive = true;

            // Create a simple context that updates local state
            const localContext = {
                log: (text: string, type: LogEntry["type"] = "info") => {
                    const idx = sessions.findIndex((s) => s.id === sessionId);
                    if (idx !== -1) {
                        sessions[idx].logs = [
                            ...sessions[idx].logs,
                            { text, type, timestamp: Date.now() },
                        ];
                        autoScrollIfNeeded();
                    }
                },
                info: (text: string) => localContext.log(text, "info"),
                error: (text: string) => localContext.log(text, "error"),
                success: (text: string) => localContext.log(text, "success"),
                warning: (text: string) => localContext.log(text, "warning"),

                onceKilled: (cb: () => void) => {
                    killCallback = cb;
                },
                kill: () => {
                    if (!isAlive) return;
                    localContext.error("^C");
                    if (killCallback) {
                        try {
                            killCallback();
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    localContext.fail();
                },

                complete: () => {
                    if (!isAlive) return;
                    isAlive = false;
                    const idx = sessions.findIndex((s) => s.id === sessionId);
                    if (idx !== -1) {
                        sessions[idx].status = "completed";
                        autoScrollIfNeeded();
                    }
                    if (activeCommandContext === localContext)
                        activeCommandContext = null;
                },
                fail: () => {
                    if (!isAlive) return;
                    isAlive = false;
                    const idx = sessions.findIndex((s) => s.id === sessionId);
                    if (idx !== -1) {
                        sessions[idx].status = "error";
                        autoScrollIfNeeded();
                    }
                    if (activeCommandContext === localContext)
                        activeCommandContext = null;
                },
            };

            activeCommandContext = localContext;
            onCommand(command, localContext as unknown as CommandContext);
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.ctrlKey && e.key === "c") {
            if (activeCommandContext) {
                e.preventDefault();
                activeCommandContext.kill();
                activeCommandContext = null;
                autoScrollIfNeeded();
                return;
            }
        }

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
        if (collapsedSessions.has(sessionId)) {
            collapsedSessions.delete(sessionId);
        } else {
            collapsedSessions.add(sessionId);
        }
        collapsedSessions = new Set(collapsedSessions);
    }

    function isCollapsed(sessionId: string): boolean {
        return collapsedSessions.has(sessionId);
    }

    function focusInput() {
        inputRef?.focus();
    }

    function formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    export function clear() {
        if (yArray) {
            yArray.doc?.transact(() => {
                yArray.delete(0, yArray.length);
            });
        } else {
            sessions = [];
        }
        collapsedSessions = new Set();
    }

    export interface SessionWatcher {
        sessionId: string;
        onLog: (callback: (log: LogEntry) => void) => void;
        onComplete: (callback: () => void) => void;
        onError: (callback: () => void) => void;
        dispose: () => void;
    }

    export function exec(command: string): SessionWatcher | undefined {
        const trimmedCommand = command.trim();
        if (!trimmedCommand) return;

        const sessionId = crypto.randomUUID();
        const ownerId = awareness?.clientID ?? -1;

        const newSession: CommandSession = {
            id: sessionId,
            command: trimmedCommand,
            timestamp: Date.now(),
            logs: [],
            status: "running",
            ownerId,
        };

        // Callbacks for watchers
        const logCallbacks: ((log: LogEntry) => void)[] = [];
        const completeCallbacks: (() => void)[] = [];
        const errorCallbacks: (() => void)[] = [];
        let lastLogCount = 0;
        let disposed = false;

        const watcher: SessionWatcher = {
            sessionId,
            onLog: (cb) => {
                logCallbacks.push(cb);
            },
            onComplete: (cb) => {
                completeCallbacks.push(cb);
            },
            onError: (cb) => {
                errorCallbacks.push(cb);
            },
            dispose: () => {
                disposed = true;
            },
        };

        // Watch for session changes
        const checkSession = () => {
            if (disposed) return;

            const arr = yArray ? yArray.toArray() : sessions;
            const session = arr.find((s) => s.id === sessionId);
            if (!session) return;

            // Check for new logs
            if (session.logs.length > lastLogCount) {
                const newLogs = session.logs.slice(lastLogCount);
                lastLogCount = session.logs.length;
                newLogs.forEach((log) => logCallbacks.forEach((cb) => cb(log)));
            }

            // Check for completion
            if (session.status === "completed") {
                completeCallbacks.forEach((cb) => cb());
                disposed = true;
            } else if (session.status === "error") {
                errorCallbacks.forEach((cb) => cb());
                disposed = true;
            }
        };

        if (yArray) {
            // Watch yArray for changes
            const observer = () => checkSession();
            yArray.observe(observer);
            watcher.dispose = () => {
                disposed = true;
                yArray?.unobserve(observer);
            };

            yArray.push([newSession]);
            const context = new CommandContext(
                sessionId,
                yArray,
                autoScrollIfNeeded,
            );

            setTimeout(() => {
                if (!disposed) {
                    onCommand!(trimmedCommand, context);
                }
            }, 0);
        } else {
            // Fallback for non-yjs mode - wrap local context to trigger checks
            sessions = [...sessions, newSession];

            const localContext = {
                log: (text: string, type: LogEntry["type"] = "info") => {
                    const idx = sessions.findIndex((s) => s.id === sessionId);
                    if (idx !== -1) {
                        sessions[idx].logs = [
                            ...sessions[idx].logs,
                            { text, type, timestamp: Date.now() },
                        ];
                        autoScrollIfNeeded();
                        checkSession();
                    }
                },
                info: (text: string) => localContext.log(text, "info"),
                error: (text: string) => localContext.log(text, "error"),
                success: (text: string) => localContext.log(text, "success"),
                warning: (text: string) => localContext.log(text, "warning"),

                // Add stubbed kill methods for exec calls (not interactive, so no user kill)
                onceKilled: () => {},
                kill: () => {},

                complete: () => {
                    const idx = sessions.findIndex((s) => s.id === sessionId);
                    if (idx !== -1) {
                        sessions[idx].status = "completed";
                        autoScrollIfNeeded();
                        checkSession();
                    }
                },
                fail: () => {
                    const idx = sessions.findIndex((s) => s.id === sessionId);
                    if (idx !== -1) {
                        sessions[idx].status = "error";
                        autoScrollIfNeeded();
                        checkSession();
                    }
                },
            };

            setTimeout(() => {
                if (!disposed) {
                    onCommand!(
                        trimmedCommand,
                        localContext as unknown as CommandContext,
                    );
                }
            }, 0);
        }

        return watcher;
    }

    export function focus() {
        inputRef?.focus();
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
        onscroll={handleScroll}
    >
        {#each sessions as session (session.id)}
            <div
                class="command-session"
                class:collapsed={isCollapsed(session.id)}
            >
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
                            {isCollapsed(session.id) ? "+" : "-"}
                        </span>
                    </div>
                {/if}

                {#if !isCollapsed(session.id)}
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
    .terminal-container {
        background-color: var(--term-bg);
        color: var(--term-text);
        font-family: var(--term-font);
        border: 2px solid var(--term-border);
        border-radius: 0;
        display: flex;
        flex-direction: column;
        height: 100%;
        position: relative;
        box-shadow: 4px 4px 0px #000000;
    }

    .terminal-content {
        flex: 1;
        overflow-y: auto;
        padding: 0;
        scrollbar-width: thin;
        scrollbar-color: var(--term-border) var(--term-bg);
    }

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
        background: var(--term-text);
    }

    .command-session {
        border-bottom: 1px solid var(--term-border);
        background: var(--term-session-bg);
        transition: none;
    }

    .command-session:hover {
        background: var(--term-bg);
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
        border-radius: 0;
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
        color: var(--term-text);
        font-weight: 700;
    }

    .timestamp {
        color: var(--term-border);
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
        border-top: 1px dashed var(--term-border);
        background-color: var(--term-session-bg);
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
        color: var(--term-cyan);
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
        color: var(--term-text);
        font-family: inherit;
        font-size: 1rem;
        outline: none;
        padding: 0;
        margin: 0;
        caret-color: var(--term-green);
    }
</style>
