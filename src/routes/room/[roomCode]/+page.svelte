<script lang="ts">
    import { page } from "$app/stores";
    import { get } from "svelte/store";
    import Monaco, { LOADING } from "$lib/components/Monaco.svelte";
    import Header from "$lib/components/Header.svelte";
    import Terminal, {
        CommandContext,
        type CommandSession,
    } from "$lib/components/Terminal.svelte";
    import { PythonEngine } from "$lib/engine/python";
    import type { AstNode } from "$lib/engine";
    import { onMount } from "svelte";
    import { MonacoBinding } from "y-monaco";
    import { getYjsDoc, getYjsProvider } from "$lib/partyContext";
    import type * as monaco from "monaco-editor";
    import type * as Y from "yjs";
    import ChallengeManager from "$lib/components/ChallengeManager.svelte";
    import ProblemSelector from "$lib/components/ProblemSelector.svelte";
    import TimerOverlay from "$lib/components/TimerOverlay.svelte";
    import {
        Challenge,
        CHALLENGES,
        type ChallengeContext,
        type FailureInfo,
    } from "$lib/challenges";
    import { PROBLEMS, type Problem } from "$lib/problems";
    import type { Engine, EngineResult } from "$lib/engine";
    import { settings } from "$lib/settings";

    import { timer } from "$lib/timerStore";
    import { getPartySocket } from "$lib/partyContext";
    import { driver } from "driver.js";
    import "driver.js/dist/driver.css";

    const socket = getPartySocket();

    let activeChallenge: Challenge | null = $state(null);
    let activeChallengeId: string | null = $state(null);
    let activeProblem: Problem | null = $state(null);
    let editorVisible = $state(true);
    let failureInfo: FailureInfo | null = $state(null);

    let ENGINE:
        | Engine<EngineResult, AstNode>
        | Promise<Engine<EngineResult, AstNode>>
        | undefined = undefined;

    // Functions passed to ChallengeManager - only update Yjs
    function setChallenge(challengeId: string, config?: any) {
        yDoc.getMap("challenge").set("active", { id: challengeId, config });
    }

    function clearChallenge() {
        yDoc.getMap("challenge").delete("active");
    }

    function setProblem(problemId: string) {
        yDoc.getMap("problem").set("active", problemId);
        // Start timer via Yjs - scheduled for 10 seconds in the future
        const timerMap = yDoc.getMap("timer");
        timerMap.set("startedAt", Date.now() + 10000);
        timerMap.delete("stoppedAt");
    }

    function clearProblem() {
        yDoc.getMap("problem").delete("active");
        // Reset timer via Yjs
        const timerMap = yDoc.getMap("timer");
        timerMap.delete("startedAt");
        timerMap.delete("stoppedAt");
    }

    function giveUp() {
        clearProblem();
    }

    function closeCongrats() {
        clearProblem();
    }

    function closeFailure() {
        // CHANGED: Only clear local state.
        // We do NOT delete from yDoc here, or it would close for everyone.
        failureInfo = null;
        clearProblem();
    }

    // Internal function called by observer - actually activates the challenge
    async function activateChallenge(challengeId: string, config?: any) {
        activeChallenge?.deactivate();

        if (!monacoEditor || !yDoc || !terminalAwareness) return;

        if (!ENGINE) {
            ENGINE = PythonEngine.new();
        }

        const context: ChallengeContext = {
            editor: monacoEditor,
            yDoc: yDoc,
            awareness: terminalAwareness,
            engine: await ENGINE,
            onMessage: (type, message) => {
                if (!terminalYArray) return;
                terminalYArray.push([
                    {
                        id: crypto.randomUUID(),
                        command: "system",
                        timestamp: Date.now(),
                        logs: [{ text: message, type, timestamp: Date.now() }],
                        status: "completed" as const,
                        ownerId: -1,
                    },
                ]);
            },
            onFail: (info: FailureInfo) => {
                console.log("Challenge failed:", info);
                // CHANGED: Add timestamp. This ensures that even if the same error
                // happens twice, Yjs sees it as a "new" change and re-opens the window.
                yDoc.getMap("failure").set("info", {
                    ...info,
                    timestamp: Date.now(),
                });
            },
            exec(command: string) {
                return terminalRef?.exec(command);
            },
        };

        if (challengeId === "blind-coding") {
            activeChallenge = new CHALLENGES[challengeId](
                context,
                (visible: boolean) => (editorVisible = visible),
                config,
            );
        } else {
            activeChallenge = new CHALLENGES[challengeId](context, config);
        }

        activeChallenge.activate();
        activeChallengeId = challengeId;
    }

    function deactivateChallenge() {
        activeChallenge?.deactivate();
        activeChallenge = null;
        activeChallengeId = null;
    }

    // Get room code synchronously
    const roomCode = get(page).params.roomCode;

    // Get yjs doc and provider from layout context
    const yDoc = getYjsDoc();
    const provider = getYjsProvider();

    let monacoValue: string | typeof LOADING | undefined = $state("");
    let monacoEditor: monaco.editor.IStandaloneCodeEditor | undefined =
        $state(undefined);

    let binding: MonacoBinding | undefined;

    // yjs state for terminal
    const terminalYArray: Y.Array<CommandSession> =
        yDoc.getArray<CommandSession>("terminal-sessions");
    const terminalAwareness = provider.awareness;

    // Resizable terminal state
    let terminalHeight = $state($settings.terminalHeight);
    let isResizing = $state(false);
    let containerRef: HTMLDivElement | undefined = $state();

    // Terminal component reference
    let terminalRef: ReturnType<typeof Terminal> | undefined;

    function startResize(e: MouseEvent) {
        e.preventDefault();
        isResizing = true;
        document.addEventListener("mousemove", onResize);
        document.addEventListener("mouseup", stopResize);
    }

    function onResize(e: MouseEvent) {
        if (!isResizing || !containerRef) return;
        const containerRect = containerRef.getBoundingClientRect();
        const newHeight = containerRect.bottom - e.clientY;
        // Clamp between 100px and 80% of container height
        const maxHeight = containerRect.height * 0.8;
        const minHeight = 100;
        terminalHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    }

    function stopResize() {
        isResizing = false;
        document.removeEventListener("mousemove", onResize);
        document.removeEventListener("mouseup", stopResize);
        settings.setTerminalHeight(terminalHeight);
    }

    function startTutorial() {
        const d = driver({
            showProgress: true,
            popoverClass: "driverjs-theme",
            overlayClickBehavior: () => {},
            steps: [
                {
                    element: "#problem-selector",
                    popover: {
                        title: "Select a Problem",
                        description:
                            "Choose a Python problem to solve with your partner.",
                        side: "bottom",
                        align: "start",
                    },
                },
                {
                    element: "#challenge-manager",
                    popover: {
                        title: "Add a Challenge",
                        description:
                            "Want to make it harder? Add a challenge like Blind Coding or No For Loops!",
                        side: "bottom",
                        align: "start",
                    },
                },
                {
                    element: "#editor-section",
                    popover: {
                        title: "The Editor",
                        description:
                            "Write your Python code here. Everything is synced in real-time!",
                        side: "bottom",
                        align: "start",
                    },
                },
                {
                    element: "#terminal-section",
                    popover: {
                        title: "The Terminal",
                        description:
                            "Type 'run' to execute your code and see the results.",
                        side: "top",
                        align: "start",
                    },
                },
                {
                    element: "#settings-menu",
                    popover: {
                        title: "Settings",
                        description:
                            "Customize your experience, change themes, or font size here.",
                        side: "bottom",
                        align: "end",
                    },
                },
            ],
        });

        d.drive();
    }

    onMount(() => {
        function handleKeydown(e: KeyboardEvent) {
            if (!get(settings).shortcuts) return;
            if (e.metaKey || e.ctrlKey) {
                if (e.key === "`") {
                    e.preventDefault();
                    terminalRef?.focus();
                } else if (e.key === "1") {
                    e.preventDefault();
                    monacoEditor?.focus();
                }
            }
        }

        document.addEventListener("keydown", handleKeydown);

        return () => document.removeEventListener("keydown", handleKeydown);
    });

    onMount(async () => {
        const monaco = await import("monaco-editor");
        const yText = yDoc.getText("shared");
        const challengeState = yDoc.getMap("challenge");
        const problemState = yDoc.getMap("problem");
        const timerState = yDoc.getMap("timer");
        const failureState = yDoc.getMap("failure");

        timer.bindToYMap(timerState);

        const hasSeenTutorial = localStorage.getItem("has-seen-tutorial");
        if (!hasSeenTutorial) {
            startTutorial();
            localStorage.setItem("has-seen-tutorial", "true");
        }

        const waitForEditor = setInterval(() => {
            const model = monacoEditor?.getModel();

            if (monacoEditor !== undefined && model != null) {
                clearInterval(waitForEditor);
                binding = new MonacoBinding(
                    yText,
                    model,
                    new Set([monacoEditor]),
                    null, // Pass null to disable y-monaco's built-in cursor handling
                );
                model.setEOL(monaco.editor.EndOfLineSequence.LF);

                // Check for existing challenge after editor is ready
                const data = challengeState.get("active");
                if (
                    data &&
                    typeof data === "object" &&
                    "id" in data &&
                    typeof data.id === "string"
                ) {
                    const config = "config" in data ? data.config : undefined;
                    activateChallenge(data.id, config);
                }

                // Check for existing problem after editor is ready
                const problemId = problemState.get("active");
                if (typeof problemId === "string" && PROBLEMS[problemId]) {
                    activeProblem = PROBLEMS[problemId];
                }
            }
        }, 100);

        // CHANGED: Observer logic
        failureState.observe(() => {
            const info = failureState.get("info");
            // Always update local state when shared state changes
            if (info) {
                failureInfo = info as FailureInfo;
            }
        });

        const currentFailure = failureState.get("info");
        if (currentFailure) {
            failureInfo = currentFailure as FailureInfo;
        }

        challengeState.observe(async () => {
            const data = challengeState.get("active");

            if (
                data &&
                typeof data === "object" &&
                "id" in data &&
                typeof data.id === "string"
            ) {
                const config = "config" in data ? data.config : undefined;
                await activateChallenge(data.id, config);
            } else if (!data && activeChallenge) {
                deactivateChallenge();
            }
        });

        problemState.observe(() => {
            const problemId = problemState.get("active");
            if (typeof problemId === "string" && PROBLEMS[problemId]) {
                activeProblem = PROBLEMS[problemId];
            } else {
                activeProblem = null;
            }
        });
    });

    async function handleCommand(command: string, context: CommandContext) {
        const cmd = command.toLowerCase().trim();

        switch (cmd) {
            case "run":
                await runCode(context);
                break;

            case "clear":
                terminalRef?.clear();
                return;

            case "help":
                showHelp(context);
                break;

            default:
                context.error(`Unknown command: ${command}`);
                context.info("Type 'help' for available commands");
                context.fail();
                break;
        }
    }

    async function runCode(context: CommandContext) {
        // Check if editor is ready
        if (monacoValue === LOADING) {
            context.error("Editor is still loading...");
            context.warning("Please wait for the editor to initialize");
            context.fail();
            return;
        }

        // Check if there's code to run
        if (monacoValue === undefined || !monacoValue.trim()) {
            context.warning("No code to execute");
            context.info("Write some Python code in the editor first");
            context.fail();
            return;
        }

        context.info("Executing Python code...");

        try {
            if (!ENGINE) {
                ENGINE = PythonEngine.new();
            }

            const result = await (await ENGINE).run(monacoValue);
            let stdoutLines: string[] = [];

            context.onceKilled(() => {
                result.kill();
                context.error("Execution killed by user");
                context.fail();
            });

            result.on("stdout", (data: string) => {
                context.info(data);
                stdoutLines.push(data);
            });

            result.on("stderr", (data: string) => {
                context.error(data);
            });

            result.on(
                "finished",
                (outcome: { ok: boolean; value?: any; error?: string }) => {
                    if (outcome.ok) {
                        context.success(`Execution completed`);

                        // Check answer if problem is active
                        if (activeProblem) {
                            // Try to get answer from return value or last stdout line
                            let answer: string | undefined;

                            if (outcome.value != undefined) {
                                answer = String(outcome.value).trim();
                                context.info(`Result: ${answer}`);
                            } else if (stdoutLines.length > 0) {
                                // Get last non-empty stdout line
                                answer =
                                    stdoutLines[stdoutLines.length - 1].trim();
                            }

                            if (answer) {
                                const expected = String(
                                    activeProblem.expectedAnswer,
                                ).trim();

                                if (answer === expected) {
                                    context.success(`✓ Correct answer!`);
                                    const timerMap = yDoc.getMap("timer");
                                    timerMap.set("stoppedAt", Date.now());
                                } else {
                                    context.error(`✗ Wrong answer. Try again!`);
                                }
                            }
                        } else if (outcome.value != undefined) {
                            context.info(`Result: ${outcome.value}`);
                        }

                        context.complete();
                    } else {
                        context.error(`Execution failed`);
                        if (outcome.error) {
                            context.error(outcome.error);
                        }
                        context.fail();
                    }
                },
            );
        } catch (error) {
            context.error("Failed to execute code");
            context.error(
                error instanceof Error ? error.message : String(error),
            );
            context.fail();
        }
    }

    function showHelp(context: CommandContext) {
        context.info("Available commands:");
        context.info(
            "  run             - Execute the Python code in the editor",
        );
        context.info("  ^C (control C)  - Stop Python code execution");
        context.info("  help            - Show this help message");
        context.info("  clear           - Clear the terminal");
        context.complete();
    }
</script>

<div
    class="page-container"
    bind:this={containerRef}
    class:resizing={isResizing}
>
    <Header theme={$settings.theme} onShowTutorial={startTutorial}>
        {#snippet middle()}
            <div id="challenge-manager">
                <ChallengeManager
                    {activeChallenge}
                    {activeChallengeId}
                    onActivate={setChallenge}
                    onDeactivate={clearChallenge}
                    theme={$settings.theme}
                />
            </div>
            <div id="problem-selector">
                <ProblemSelector
                    {activeProblem}
                    onSelect={setProblem}
                    onClear={clearProblem}
                    theme={$settings.theme}
                />
            </div>
            {#if activeProblem}
                <button class="give-up-btn" onclick={giveUp}>Give Up</button>
            {/if}
        {/snippet}
    </Header>

    {#if $timer.countdown !== null}
        <div class="countdown-overlay">
            <div class="countdown-content">
                <h2>Get ready! 📖</h2>
                {#if activeProblem}
                    <div class="problem-preview">
                        <h3>{activeProblem.title}</h3>
                        <p>{activeProblem.description}</p>
                    </div>
                {/if}
                <p class="instruction">Read the problem description above.</p>
                <div class="countdown-number">{$timer.countdown}</div>
            </div>
        </div>
    {/if}

    {#if $timer.stoppedAt !== null}
        <div class="congrats-overlay">
            <div class="congrats-card">
                <h1>🎉 Congratulations! 🎉</h1>
                <p>You solved <strong>{activeProblem?.title}</strong></p>
                <div class="stats">
                    <span class="label">Time taken:</span>
                    <span class="value"
                        >{Math.floor($timer.elapsed / 60)
                            .toString()
                            .padStart(2, "0")}:{($timer.elapsed % 60)
                            .toString()
                            .padStart(2, "0")}</span
                    >
                </div>
                <button onclick={closeCongrats}>Awesome!</button>
            </div>
        </div>
    {/if}

    {#if failureInfo !== null}
        <div class="failure-overlay">
            <div class="failure-card">
                <h1>{failureInfo.title ?? "Challenge Failed"}</h1>
                <p class="failure-reason">{failureInfo.reason}</p>
                {#if failureInfo.details}
                    <div class="failure-details">
                        <pre>{failureInfo.details}</pre>
                    </div>
                {/if}
                {#if failureInfo.suggestion}
                    <p class="failure-suggestion">{failureInfo.suggestion}</p>
                {/if}
                <button onclick={closeFailure}>Try Again</button>
            </div>
        </div>
    {/if}

    <div
        id="editor-section"
        class="editor-section"
        class:hidden={!editorVisible}
    >
        <Monaco
            bind:value={monacoValue}
            bind:editor={monacoEditor}
            fontSize={$settings.fontSize}
            theme={$settings.theme}
            awareness={terminalAwareness}
            showCursors={$settings.showCursors}
        />
        {#if activeChallengeId === "activity-timer"}
            <TimerOverlay awareness={terminalAwareness} />
        {/if}
    </div>

    <div
        class="resize-handle"
        onmousedown={startResize}
        role="separator"
        aria-orientation="horizontal"
        tabindex="-1"
    ></div>

    <div
        id="terminal-section"
        class="terminal-section"
        style="height: {terminalHeight}px"
    >
        <Terminal
            bind:this={terminalRef}
            onCommand={handleCommand}
            welcomeMessage="Welcome to room '{roomCode}'!

Type 'run' to execute your Python code, control C (^C) to stop execution, 'help' for available commands, or 'clear' to clear the terminal."
            maxHeight="100%"
            yArray={terminalYArray}
            awareness={terminalAwareness}
        />
    </div>
</div>

<style>
    /* Hide y-monaco default cursors to use monaco-collab-ext instead */
    :global(.yRemoteSelection) {
        background-color: transparent !important;
    }
    :global(.yRemoteSelectionHead) {
        border: none !important;
    }
    :global(.yRemoteSelectionHead::after) {
        display: none !important;
    }

    .page-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        width: 100vw;
        overflow: hidden;
    }

    .page-container.resizing {
        cursor: ns-resize;
        user-select: none;
    }

    .editor-section {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        position: relative;
    }

    .editor-section.hidden :global(.monaco-editor .view-lines) {
        opacity: 0;
    }

    .editor-section.hidden :global(.monaco-editor .cursors-layer) {
        opacity: 1;
    }

    .resize-handle {
        height: 6px;
        background: var(--resize-bg);
        cursor: ns-resize;
        flex-shrink: 0;
        position: relative;
        transition: background-color 0.2s;
    }

    .resize-handle::before {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 40px;
        height: 2px;
        background: var(--resize-handle);
        transition: background-color 0.2s;
    }

    .resize-handle:hover {
        background: var(--resize-hover-bg);
    }

    .resize-handle:hover::before {
        background: var(--resize-hover-handle);
    }

    .terminal-section {
        flex-shrink: 0;
    }

    .give-up-btn {
        background: var(--term-red);
        color: white;
        border: none;
        padding: 4px 12px;
        font-family: var(--term-font);
        cursor: pointer;
        font-size: 0.85rem;
    }

    .give-up-btn:hover {
        opacity: 0.8;
    }

    .congrats-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        backdrop-filter: blur(4px);
    }

    .congrats-card {
        background: var(--term-bg);
        border: 4px solid var(--term-green);
        padding: 2rem;
        text-align: center;
        max-width: 400px;
        box-shadow: 8px 8px 0 var(--term-border);
    }

    .congrats-card h1 {
        color: var(--term-green);
        margin-top: 0;
    }

    .stats {
        margin: 1.5rem 0;
        font-size: 1.25rem;
    }

    .stats .label {
        color: var(--term-text);
        margin-right: 0.5rem;
    }

    .stats .value {
        color: var(--term-yellow);
        font-weight: bold;
        font-family: var(--term-font);
    }

    .congrats-card button {
        background: var(--term-green);
        color: var(--term-bg);
        border: none;
        padding: 10px 24px;
        font-family: var(--term-font);
        font-weight: bold;
        cursor: pointer;
        font-size: 1rem;
    }

    .congrats-card button:hover {
        opacity: 0.9;
        transform: translate(-2px, -2px);
        box-shadow: 2px 2px 0 var(--term-border);
    }

    .countdown-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1500;
        backdrop-filter: blur(2px);
    }

    .countdown-content {
        background: var(--term-bg);
        border: 4px solid var(--term-cyan);
        padding: 2rem;
        text-align: center;
        min-width: 300px;
        box-shadow: 8px 8px 0 var(--term-border);
    }

    .countdown-content h2 {
        color: var(--term-cyan);
        margin-top: 0;
    }

    .problem-preview {
        background: var(--term-session-bg);
        border: 1px solid var(--term-border);
        padding: 1.5rem;
        margin: 1rem 0;
        text-align: left;
        max-height: 40vh;
        overflow-y: auto;
    }

    .problem-preview h3 {
        margin-top: 0;
        color: var(--term-yellow);
    }

    .problem-preview p {
        white-space: pre-wrap;
        color: var(--term-text);
        line-height: 1.5;
    }

    .instruction {
        color: var(--term-border);
        font-style: italic;
    }

    .countdown-number {
        font-size: 5rem;
        font-weight: bold;
        color: var(--term-yellow);
        font-family: var(--term-font);
        margin-top: 1rem;
    }

    .failure-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        backdrop-filter: blur(4px);
    }

    .failure-card {
        background: var(--term-bg);
        border: 4px solid var(--term-red);
        padding: 2rem;
        text-align: center;
        max-width: 500px;
        box-shadow: 8px 8px 0 var(--term-border);
    }

    .failure-card h1 {
        color: var(--term-red);
        margin-top: 0;
    }

    .failure-reason {
        color: var(--term-text);
        font-size: 1.1rem;
        margin: 1rem 0;
    }

    .failure-details {
        background: var(--term-session-bg);
        border: 1px solid var(--term-border);
        padding: 1rem;
        margin: 1rem 0;
        text-align: left;
        max-height: 200px;
        overflow-y: auto;
    }

    .failure-details pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        color: var(--term-red);
        font-family: var(--term-font);
        font-size: 0.9rem;
    }

    .failure-suggestion {
        color: var(--term-cyan);
        font-style: italic;
        margin: 1rem 0;
    }

    .failure-card button {
        background: var(--term-red);
        color: white;
        border: none;
        padding: 10px 24px;
        font-family: var(--term-font);
        font-weight: bold;
        cursor: pointer;
        font-size: 1rem;
        margin-top: 0.5rem;
    }

    .failure-card button:hover {
        opacity: 0.9;
        transform: translate(-2px, -2px);
        box-shadow: 2px 2px 0 var(--term-border);
    }
</style>
