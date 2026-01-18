<script lang="ts">
    import { page } from "$app/stores";
    import { get } from "svelte/store";
    import { onMount, onDestroy } from "svelte";
    import * as Y from "yjs";
    import YPartyKitProvider from "y-partykit/provider";
    import { setYjsProvider, setYjsDoc } from "$lib/partyContext";
    import { settings } from "$lib/settings";
    import { env } from "$env/dynamic/public";
    import { PUBLIC_PARTYKIT_HOST as STATIC_HOST } from "$env/static/public";

    let { children } = $props();

    const roomCode = get(page).params.roomCode;

    const colors = [
        "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff",
        "#ff8800", "#88ff00", "#0088ff", "#ff0088", "#8800ff", "#00ff88"
    ];
    const userColor = colors[Math.floor(Math.random() * colors.length)];

    const yDoc = new Y.Doc();
    
    // LAYERED LOOKUP:
    // 1. Try static env (available if provided during build)
    // 2. Try dynamic env (available if provided during runtime on server-rendered page)
    // 3. Try hardcoded fallback or current domain
    const partyHost = STATIC_HOST || env.PUBLIC_PARTYKIT_HOST || (typeof window !== "undefined" ? window.location.host : "localhost:1999");
    
    if (typeof window !== "undefined") {
        console.log("[DEBUG] Connection Info:", {
            staticHost: STATIC_HOST,
            dynamicHost: env.PUBLIC_PARTYKIT_HOST,
            selectedHost: partyHost
        });
    }

    const isLocalhost = partyHost.includes("localhost") || partyHost.includes("127.0.0.1");
    const provider = new YPartyKitProvider(
        partyHost,
        `game-${roomCode}`,
        yDoc,
        { protocol: isLocalhost ? "ws" : "wss", connect: false }
    );

    setYjsDoc(yDoc);
    setYjsProvider(provider);

    let pendingIdentifyName: string | null = null;

    function sendIdentify(name: string) {
        const payload = JSON.stringify({ type: "identify", name });

        if (provider.wsconnected && provider.ws) {
            console.log("[client] sending identify", { name, room: roomCode });
            provider.ws.send(payload);
            pendingIdentifyName = null;
            return;
        }

        console.log("[client] queue identify", { name, room: roomCode });
        pendingIdentifyName = name;
    }

    function getDisplayName() {
        return $settings.userName || `Guest ${Math.floor(Math.random() * 1000)}`;
    }

    onMount(() => {
        provider.connect();

        const handleStatus = ({ status }: { status: string }) => {
            console.log("[client] provider status", { status, room: roomCode });
            if (status === "connected" && pendingIdentifyName) {
                sendIdentify(pendingIdentifyName);
            }
        };

        provider.on("status", handleStatus);

        const initialName = getDisplayName();
        provider.awareness.setLocalStateField("user", {
            name: initialName,
            color: userColor,
        });
        sendIdentify(initialName);

        return () => {
            if (provider.off) {
                provider.off("status", handleStatus);
            }
        };
    });

    $effect(() => {
        const name = getDisplayName();
        provider.awareness.setLocalStateField("user", {
            name,
            color: userColor,
        });

        if (provider.shouldConnect) {
            sendIdentify(name);
        }
    });

    onDestroy(() => {
        provider.disconnect();
    });
</script>

{@render children()}
