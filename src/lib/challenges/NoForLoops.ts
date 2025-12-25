// lib/challenges/NoForLoops.ts
import { Challenge, type ChallengeContext } from './base';

export class NoForLoops extends Challenge {
    activate(): void {
        const disposable = this.context.editor.onDidChangeModelContent(() => {
            const content = this.context.editor.getValue();

            if (/\bfor\s+\w+\s+in\b/.test(content)) {
                this.context.editor.getModel()?.undo();
                this.context.onMessage('error', '❌ For loops are forbidden!');
            }
        });

        this.disposables.push(disposable);
    }

    getConfig() { return {}; }
    getName() { return 'No For Loops'; }
    getDescription() { return 'For loops are disabled'; }
}