<script lang="ts">
    import { goto } from "$app/navigation";

    let roomCode = $state("");

    function generateRoomCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    function joinRoom() {
        if (roomCode.trim()) {
            goto(`/room/${roomCode.trim().toUpperCase()}`);
        }
    }

    function createRoom() {
        goto(`/room/${generateRoomCode()}`);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            joinRoom();
        }
    }
</script>

<div class="landing">
    <h1>Pair Programming Challenge</h1>
    <p class="subtitle">Collaborative coding with real-time sync</p>

    <div class="actions">
        <div class="join-section">
            <input
                type="text"
                bind:value={roomCode}
                onkeydown={handleKeydown}
                placeholder="Enter room code"
                maxlength="10"
            />
            <button onclick={joinRoom} disabled={!roomCode.trim()}>Join Room</button>
        </div>

        <div class="divider">or</div>

        <button class="create-btn" onclick={createRoom}>Create New Room</button>
    </div>
</div>

<style>
    .landing {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: var(--term-font);
        background: var(--term-bg);
        padding: 20px;
    }

    h1 {
        color: var(--term-green);
        font-size: 2rem;
        margin: 0 0 0.5rem 0;
        text-align: center;
    }

    .subtitle {
        color: var(--term-text);
        margin: 0 0 3rem 0;
        opacity: 0.7;
    }

    .actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
        width: 100%;
        max-width: 300px;
    }

    .join-section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        width: 100%;
    }

    input {
        background: var(--term-session-bg);
        border: 2px solid var(--term-border);
        color: var(--term-text);
        font-family: var(--term-font);
        font-size: 1.2rem;
        padding: 0.75rem 1rem;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.2em;
    }

    input::placeholder {
        text-transform: none;
        letter-spacing: normal;
        opacity: 0.5;
    }

    input:focus {
        outline: none;
        border-color: var(--term-green);
    }

    button {
        background: transparent;
        border: 2px solid var(--term-border);
        color: var(--term-text);
        font-family: var(--term-font);
        font-size: 1rem;
        padding: 0.75rem 1.5rem;
        cursor: pointer;
        width: 100%;
        transition: all 0.15s;
    }

    button:hover:not(:disabled) {
        background: var(--term-border);
        color: #fff;
    }

    button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .create-btn {
        border-color: var(--term-green);
        color: var(--term-green);
    }

    .create-btn:hover {
        background: var(--term-green);
        color: #000;
    }

    .divider {
        color: var(--term-text);
        opacity: 0.5;
        font-size: 0.85rem;
    }
</style>
