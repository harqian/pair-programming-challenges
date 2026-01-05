<script lang="ts">
    import { page } from "$app/stores";
    import { get } from "svelte/store";
    import { onMount, onDestroy } from "svelte";
    import * as Y from "yjs";
    import YPartyKitProvider from "y-partykit/provider";
    import { setYjsProvider, setYjsDoc } from "$lib/partyContext";
    import { settings } from "$lib/settings";

    let { children } = $props();

    // Get room code synchronously for socket creation
    const roomCode = get(page).params.roomCode;

    const colors = [
        "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff",
        "#ff8800", "#88ff00", "#0088ff", "#ff0088", "#8800ff", "#00ff88"
    ];
    const userColor = colors[Math.floor(Math.random() * colors.length)];

    const yDoc = new Y.Doc();
    const provider = new YPartyKitProvider(
        `${globalThis.location?.hostname ?? "localhost"}:1999`,
        `game-${roomCode}`,
        yDoc,
        {
            protocol: "ws",
            connect: false,
        },
    );

    setYjsDoc(yDoc);
    setYjsProvider(provider);

    onMount(() => {
        provider.connect();
    });

    $effect(() => {
        const name = $settings.userName || `Guest ${Math.floor(Math.random() * 1000)}`;
        provider.awareness.setLocalStateField("user", {
            name,
            color: userColor,
        });

        // Identify to the server for system messages
        if (provider.shouldConnect) {
            provider.ws?.send(JSON.stringify({
                type: "identify",
                name
            }));
        }
    });

    onDestroy(() => {
        provider.disconnect();
    });
</script>

{@render children()}
