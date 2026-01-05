import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";
import * as Y from "yjs";

export default class Server implements Party.Server {
    constructor(readonly room: Party.Room) { }

    // Track names by connection ID
    connectionNames = new Map<string, string>();

    async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
        return onConnect(conn, this.room, {
            persist: true,
            callback: {
                handler: async (doc) => {
                    // We can observe the doc for name updates if needed,
                    // but for now we'll handle join/leave via connection hooks.
                }
            }
        });
    }

    onMessage(message: string, sender: Party.Connection) {
        try {
            const data = JSON.parse(message);
            if (data.type === "identify") {
                const oldName = this.connectionNames.get(sender.id);
                const newName = data.name;
                this.connectionNames.set(sender.id, newName);

                // If this is the first time they identify, log the join
                if (!oldName) {
                    this.logToTerminal(`=${newName}= joined the room!`, "success");
                } else if (oldName !== newName) {
                    // Optional: log name change
                }
            }
        } catch (e) {
            // Not our message or malformed
        }
    }

    onClose(conn: Party.Connection) {
        const name = this.connectionNames.get(conn.id);
        if (name) {
            this.logToTerminal(`=${name}= left the room.`, "warning");
            this.connectionNames.delete(conn.id);
        }
    }

    private async logToTerminal(text: string, type: "success" | "warning" | "info") {
        // We'll use a special message type that the client-side Terminal 
        // will listen for to update the shared Yjs array once.
        // Actually, it's better to just broadcast a signal and let the clients 
        // handle it, but to avoid duplicates, the server should ideally 
        // be the one to modify the Yjs doc.
        
        // Since y-partykit manages the doc, we can broadcast a custom event
        // that the FIRST connected client will use to update the Yjs array.
        // Or better, we just broadcast it to all clients to show locally.
        
        this.room.broadcast(JSON.stringify({
            type: "system_message",
            text,
            messageType: type,
            timestamp: Date.now()
        }));
    }
}