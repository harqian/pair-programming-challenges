// lib/challenges/ActivityTimer.ts
import { Challenge, type ChallengeContext } from './base';

interface ActivityTimerConfig {
    seconds: number;
}

export interface TimerState {
    timeRemaining: number;  // in milliseconds
    isLocked: boolean;
}

export class ActivityTimer extends Challenge {
    private config: ActivityTimerConfig;
    private countdownInterval?: ReturnType<typeof setInterval>;
    private timeRemaining: number = 0;
    private isLocked: boolean = false;
    private hasTriggeredAllLocked: boolean = false;
    private readonly TICK_INTERVAL = 100; // Update every 100ms for smooth countdown

    constructor(context: ChallengeContext, config: ActivityTimerConfig = { seconds: 5 }) {
        super(context);
        this.config = config;
        this.timeRemaining = config.seconds * 1000;
    }

    private get isHost(): boolean {
        const states = this.context.awareness.getStates();
        const playersWithTimer = Array.from(states.entries())
            .filter(([_, state]) => state.activityTimer)
            .map(([clientId]) => clientId)
            .sort((a, b) => a - b);

        return playersWithTimer[0] === this.context.awareness.clientID;
    }

    private checkAllLocked(): void {
        if (this.hasTriggeredAllLocked) return;
        if (!this.isHost) return;

        const states = this.context.awareness.getStates();
        const timerStates = Array.from(states.values())
            .map(state => state.activityTimer as TimerState | undefined)
            .filter((t): t is TimerState => t !== undefined);

        // Need at least one player
        if (timerStates.length === 0) return;

        const allLocked = timerStates.every(t => t.isLocked);
        if (allLocked) {
            this.hasTriggeredAllLocked = true;
            let result = this.context.exec("run")!;

            console.log(result);

            result.onLog(log => {
                console.log("Log from execution:", log);

                if (log.type === "error" && log.text.toUpperCase().includes("EXECUTION FAILED")) {
                    this.context.onFail({
                        reason: "All players have been locked out due to inactivity.",
                        details: "The code execution failed because no one could make edits.",
                        suggestion: "Consider restarting the challenge and staying active."
                    });
                }

                if (log.type === "warning" && log.text.toUpperCase().includes("NO CODE TO EXECUTE")) {
                    this.context.onFail({
                        reason: "All players have been locked out due to inactivity.",
                        details: "The code execution could not proceed because there was no code to run.",
                        suggestion: "Consider restarting the challenge and staying active."
                    });
                }
            });
        }
    }

    activate(): void {
        // Initialize timer state in awareness
        this.updateAwarenessState();

        // Reset timer only on LOCAL user input (not synced changes from other users)
        // onKeyDown fires only for local keyboard events, not from Yjs sync
        const keyDisposable = this.context.editor.onKeyDown((e) => {
            if (this.isLocked) return;

            // Reset on any key that could modify content:
            // - Printable characters (no ctrl/meta unless it's paste/cut/undo)
            // - Backspace, Delete, Enter, Tab
            const isModifier = e.ctrlKey || e.metaKey || e.altKey;
            const isEditingShortcut = isModifier && ['KeyV', 'KeyX', 'KeyZ', 'KeyY'].includes(e.code);
            const isContentKey = !isModifier && !['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock', 'Insert', 'Pause', 'ContextMenu'].includes(e.code);

            if (isEditingShortcut || isContentKey) {
                this.resetTimer();
            }
        });
        this.disposables.push(keyDisposable);

        // Listen for awareness changes to detect when all players are locked
        const awarenessHandler = () => {
            this.checkAllLocked();
        };
        this.context.awareness.on('change', awarenessHandler);
        this.disposables.push({ dispose: () => this.context.awareness.off('change', awarenessHandler) });

        // Start the countdown
        this.startCountdown();
    }

    private startCountdown(): void {
        this.countdownInterval = setInterval(() => {
            if (this.isLocked) return;

            this.timeRemaining = Math.max(0, this.timeRemaining - this.TICK_INTERVAL);
            this.updateAwarenessState();

            if (this.timeRemaining <= 0) {
                this.lockUser();
            }
        }, this.TICK_INTERVAL);
    }

    private resetTimer(): void {
        this.timeRemaining = this.config.seconds * 1000;
        this.updateAwarenessState();
    }

    private lockUser(): void {
        if (this.isLocked) return;

        this.isLocked = true;
        this.context.editor.updateOptions({ readOnly: true });
        this.updateAwarenessState();
    }

    private updateAwarenessState(): void {
        const currentState = this.context.awareness.getLocalState() || {};
        this.context.awareness.setLocalState({
            ...currentState,
            activityTimer: {
                timeRemaining: this.timeRemaining,
                isLocked: this.isLocked
            } as TimerState
        });
    }

    deactivate(): void {
        // Stop countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        // Restore editor state
        this.context.editor.updateOptions({ readOnly: false });

        // Clear timer state from awareness
        const currentState = this.context.awareness.getLocalState() || {};
        const { activityTimer, ...rest } = currentState as Record<string, any>;
        this.context.awareness.setLocalState(rest);

        super.deactivate();
    }

    getConfig() { return this.config; }
    getName() { return 'Activity Timer'; }
    getDescription() { return `${this.config.seconds}s to edit before lockout`; }
}