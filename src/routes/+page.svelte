<script lang="ts">
    import { goto } from "$app/navigation";
    import { settings } from "$lib/settings";

    let roomCode = $state("");
    let name = $state($settings.userName);

    function generateRoomCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    function joinRoom() {
        if (roomCode.trim() && name.trim()) {
            settings.setUserName(name.trim());
            goto(`/room/${roomCode.trim().toUpperCase()}`);
        }
    }

    function createRoom() {
        if (name.trim()) {
            settings.setUserName(name.trim());
            goto(`/room/${generateRoomCode()}`);
        }
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
        <div class="input-group">
            <label for="name">Your Name</label>
            <input
                id="name"
                type="text"
                bind:value={name}
                placeholder="Enter your name"
                maxlength="20"
                class="name-input"
            />
        </div>

        <div class="join-section">
            <div class="input-group">
                <label for="room">Room Code</label>
                <input
                    id="room"
                    type="text"
                    bind:value={roomCode}
                    onkeydown={handleKeydown}
                    placeholder="Enter room code"
                    maxlength="10"
                />
            </div>
            <button onclick={joinRoom} disabled={!roomCode.trim() || !name.trim()}>Join Room</button>
        </div>

        <div class="divider">or</div>

        <button class="create-btn" onclick={createRoom} disabled={!name.trim()}>Create New Room</button>
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
        font-size: 2.5rem;
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
        max-width: 320px;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
    }

    label {
        color: var(--term-green);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
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
        font-size: 1.1rem;
        padding: 0.75rem 1rem;
    }

    input#room {
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
        opacity: 0.3;
        cursor: not-allowed;
    }

    .create-btn {
        border-color: var(--term-green);
        color: var(--term-green);
    }

    .create-btn:hover:not(:disabled) {
        background: var(--term-green);
        color: #000;
    }

    .divider {
        color: var(--term-text);
        opacity: 0.5;
        font-size: 0.85rem;
    }
</style>
