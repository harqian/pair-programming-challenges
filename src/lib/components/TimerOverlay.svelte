<script lang="ts">
    import type { Awareness } from "y-protocols/awareness";
    import { onMount, onDestroy } from "svelte";
    import type { TimerState } from "$lib/challenges/ActivityTimer";

    type Props = {
        awareness: Awareness;
    };

    let { awareness }: Props = $props();

    interface UserTimer {
        clientId: number;
        name: string;
        color: string;
        timeRemaining: number;
        isLocked: boolean;
        isMe: boolean;
    }

    let userTimers: UserTimer[] = $state([]);

    function updateTimers() {
        const states = awareness.getStates();
        const myClientId = awareness.clientID;
        const timers: UserTimer[] = [];

        states.forEach((state, clientId) => {
            const timerState = state.activityTimer as TimerState | undefined;
            if (timerState) {
                timers.push({
                    clientId,
                    name: state.user?.name || `User ${clientId}`,
                    color: state.user?.color || '#888',
                    timeRemaining: timerState.timeRemaining,
                    isLocked: timerState.isLocked,
                    isMe: clientId === myClientId
                });
            }
        });

        // Sort: my timer first, then by clientId
        timers.sort((a, b) => {
            if (a.isMe) return -1;
            if (b.isMe) return 1;
            return a.clientId - b.clientId;
        });

        userTimers = timers;
    }

    function formatTime(ms: number): string {
        const seconds = ms / 1000;
        return seconds.toFixed(1) + 's';
    }

    onMount(() => {
        updateTimers();
        awareness.on('change', updateTimers);
    });

    onDestroy(() => {
        awareness.off('change', updateTimers);
    });
</script>

{#if userTimers.length > 0}
    <div class="timer-overlay">
        {#each userTimers as timer (timer.clientId)}
            <div
                class="timer-card"
                class:stress={timer.timeRemaining <= 1000 && timer.timeRemaining > 0}
                class:locked={timer.isLocked}
                class:is-me={timer.isMe}
            >
                <div class="timer-header">
                    <span class="user-indicator" style="background-color: {timer.color}"></span>
                    <span class="user-name">{timer.isMe ? 'You' : timer.name}</span>
                </div>
                <div class="timer-value" class:critical={timer.timeRemaining <= 1000}>
                    {#if timer.isLocked}
                        LOCKED
                    {:else}
                        {formatTime(timer.timeRemaining)}
                    {/if}
                </div>
            </div>
        {/each}
    </div>
{/if}

<style>
    .timer-overlay {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 100;
        pointer-events: none;
    }

    .timer-card {
        background: rgba(12, 12, 12, 0.9);
        border: 1px solid #333;
        border-radius: 6px;
        padding: 8px 12px;
        min-width: 100px;
        transition: all 0.1s ease;
    }

    .timer-card.is-me {
        border-color: #00ff41;
    }

    .timer-card.stress {
        animation: pulse 0.2s ease-in-out infinite alternate;
        border-color: #ff3333;
        background: rgba(40, 0, 0, 0.95);
    }

    .timer-card.locked {
        border-color: #ff3333;
        background: rgba(40, 0, 0, 0.9);
        opacity: 0.8;
    }

    .timer-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
    }

    .user-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .user-name {
        font-size: 11px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .timer-value {
        font-size: 24px;
        font-weight: bold;
        color: #00ff41;
        font-family: 'Consolas', monospace;
        text-align: center;
    }

    .timer-value.critical {
        color: #ff3333;
    }

    .timer-card.locked .timer-value {
        font-size: 14px;
        color: #ff3333;
    }

    @keyframes pulse {
        from {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(255, 51, 51, 0);
        }
        to {
            transform: scale(1.02);
            box-shadow: 0 0 20px rgba(255, 51, 51, 0.5);
        }
    }
</style>