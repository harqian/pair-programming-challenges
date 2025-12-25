<script lang="ts">
    import { page } from "$app/stores";
    import { get } from "svelte/store";
    import { onMount, onDestroy } from "svelte";
    import * as Y from "yjs";
    import YPartyKitProvider from "y-partykit/provider";
    import { setYjsProvider, setYjsDoc } from "$lib/partyContext";

    let { children } = $props();

    // Get room code synchronously for socket creation
    const roomCode = get(page).params.roomCode;

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

    onDestroy(() => {
        provider.disconnect();
    });
</script>

{@render children()}
