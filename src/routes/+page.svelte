<script lang="ts">
    import { goto } from "$app/navigation";
    import { settings } from "$lib/settings";

    let roomCode = $state("");
    let name = $state($settings.userName);
    let loading = $state(false);

    function generateRoomCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    async function joinRoom() {
        if (roomCode.trim() && name.trim()) {
            loading = true;
            settings.setUserName(name.trim());
            await goto(`/room/${roomCode.trim().toUpperCase()}`);
        }
    }

    async function createRoom() {
        if (name.trim()) {
            loading = true;
            settings.setUserName(name.trim());
            await goto(`/room/${generateRoomCode()}`);
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            joinRoom();
        }
    }
</script>

<div class="landing">
    {#if loading}
        <div class="loading-overlay">
            <div class="spinner"></div>
            <p>Entering terminal...</p>
        </div>
    {/if}

    <h1>debuff.dev</h1>
    <p class="subtitle">Collaborative coding with real-time sync</p>

    <div class="description">
        <p>Practice coding with friends in real-time. Share a room, pick a challenge, and solve problems together.</p>
        <ul>
            <li>Live collaborative editor - see each other's cursors</li>
            <li>Built-in Python interpreter</li>
            <li>Fun challenges like blind coding mode</li>
        </ul>
    </div>

    <div class="actions" class:loading>
        <div class="input-group">
            <label for="name">Your Name</label>
            <input
                id="name"
                type="text"
                bind:value={name}
                placeholder="Enter your name"
                maxlength="20"
                class="name-input"
                disabled={loading}
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
                    disabled={loading}
                />
            </div>
            <button onclick={joinRoom} disabled={!roomCode.trim() || !name.trim() || loading}>Join Room</button>
        </div>

        <div class="divider">or</div>

        <button class="create-btn" onclick={createRoom} disabled={!name.trim() || loading}>Create New Room</button>
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
        margin: 0 0 1.5rem 0;
        opacity: 0.7;
    }

    .description {
        max-width: 400px;
        margin-bottom: 2rem;
        color: var(--term-text);
        opacity: 0.8;
        text-align: left;
    }

    .description p {
        margin: 0 0 0.75rem 0;
        line-height: 1.4;
    }

    .description ul {
        margin: 0;
        padding-left: 1.25rem;
    }

    .description li {
        margin: 0.25rem 0;
        color: var(--term-green);
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

    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 100;
        gap: 1rem;
        backdrop-filter: blur(4px);
    }

    .loading-overlay p {
        color: var(--term-green);
        font-family: var(--term-font);
        margin: 0;
        letter-spacing: 0.05em;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--term-border);
        border-top: 3px solid var(--term-green);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .actions.loading {
        opacity: 0.5;
        pointer-events: none;
    }
</style>
