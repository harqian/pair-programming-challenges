<!-- lib/components/ProblemSelector.svelte -->
<script lang="ts">
    import { PROBLEMS, type Problem } from "$lib/problems";

    interface Props {
        onSelect: (problemId: string) => void;
        onClear: () => void;
        activeProblem: Problem | null;
    }

    let { onSelect, onClear, activeProblem }: Props = $props();

    let isOpen = $state(false);
    let selectedProblem = $state<string | null>(null);

    // Sync selection with active problem
    $effect(() => {
        selectedProblem = activeProblem?.id || null;
    });

    function handleSelect() {
        if (!selectedProblem) return;
        onSelect(selectedProblem);
        isOpen = false;
    }

    function handleClear() {
        onClear();
        selectedProblem = null;
    }
</script>

<div class="problem-selector">
    <button class="toggle-btn" onclick={() => (isOpen = !isOpen)}>
        {#if activeProblem}
            📝 {activeProblem.title}
        {:else}
            📚 Select Problem
        {/if}
    </button>

    {#if isOpen}
        <div class="panel">
            <div class="header">
                <h3>Problems</h3>
                <button onclick={() => (isOpen = false)}>✕</button>
            </div>

            <div class="problem-list">
                <label>
                    <input
                        type="radio"
                        bind:group={selectedProblem}
                        value={null}
                    />
                    None
                </label>

                {#each Object.values(PROBLEMS) as problem}
                    <label>
                        <input
                            type="radio"
                            bind:group={selectedProblem}
                            value={problem.id}
                        />
                        {problem.title}
                    </label>
                {/each}
            </div>

            {#if selectedProblem && PROBLEMS[selectedProblem]}
                <div class="description">
                    <strong>Description:</strong>
                    <p>{PROBLEMS[selectedProblem].description}</p>
                </div>
            {/if}

            <div class="actions">
                {#if activeProblem}
                    <button class="clear-btn" onclick={handleClear}>
                        Clear
                    </button>
                {/if}
                <button
                    class="select-btn"
                    onclick={handleSelect}
                    disabled={!selectedProblem}
                >
                    Select
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .problem-selector {
        position: relative;
    }

    .toggle-btn {
        padding: 8px 16px;
        background: #2c2c2c;
        border: 1px solid #444;
        color: #fff;
        cursor: pointer;
        border-radius: 4px;
    }

    .toggle-btn:hover {
        background: #333;
    }

    .panel {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        background: #1e1e1e;
        border: 1px solid #444;
        border-radius: 4px;
        padding: 16px;
        min-width: 400px;
        max-width: 600px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .header h3 {
        margin: 0;
        color: #fff;
    }

    .header button {
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        font-size: 20px;
    }

    .problem-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
    }

    .problem-list label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #ccc;
        cursor: pointer;
    }

    .description {
        background: #252525;
        padding: 12px;
        border-radius: 4px;
        margin-bottom: 16px;
        color: #ccc;
    }

    .description strong {
        color: #fff;
    }

    .description p {
        margin: 8px 0 0;
        white-space: pre-wrap;
    }

    .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    }

    .select-btn,
    .clear-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .select-btn {
        background: #0e639c;
        color: #fff;
    }

    .select-btn:disabled {
        background: #444;
        cursor: not-allowed;
    }

    .clear-btn {
        background: #d9534f;
        color: #fff;
    }
</style>
