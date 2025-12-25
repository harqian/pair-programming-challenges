// lib/challenges/ActivityTimer.ts
import { Challenge, type ChallengeContext } from './base';

interface ActivityTimerConfig {
    seconds: number;
}

export class ActivityTimer extends Challenge {
    private config: ActivityTimerConfig;
    private timer?: NodeJS.Timeout;

    constructor(context: ChallengeContext, config: ActivityTimerConfig = { seconds: 5 }) {
        super(context);
        this.config = config;
    }

    activate(): void {
        const resetTimer = () => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.context.editor.setValue('');
                this.context.onMessage('warning', '⏰ Code cleared due to inactivity!');
            }, this.config.seconds * 1000);
        };

        const disposable = this.context.editor.onDidChangeModelContent(resetTimer);
        this.disposables.push(disposable);

        resetTimer(); // Start initial timer
    }

    deactivate(): void {
        clearTimeout(this.timer);
        super.deactivate();
    }

    getConfig() { return this.config; }
    getName() { return 'Activity Timer'; }
    getDescription() { return `Code deleted after ${this.config.seconds}s inactivity`; }
}