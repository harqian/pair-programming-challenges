import type * as Party from "partykit/server";
import { onConnect, unstable_getYDoc, type YPartyKitOptions } from "y-partykit";
import * as Y from "yjs";
import { randomUUID } from "crypto";

export default class Server implements Party.Server {
    constructor(readonly room: Party.Room) { }

    private yDoc: Y.Doc | undefined;
    private readonly yjsOptions: YPartyKitOptions = {
        persist: true,
    };
    // Track names by connection ID
    connectionNames = new Map<string, string>();

    async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
        console.log("[party] onConnect", { room: this.room.id, connId: conn.id });
        await onConnect(conn, this.room, this.yjsOptions);
        await this.ensureWelcomeMessage();
    }

    onMessage(message: string, sender: Party.Connection) {
        try {
            console.log("[party] onMessage raw", {
                room: this.room.id,
                connId: sender.id,
                message,
            });
            const data = JSON.parse(message);
            if (data.type === "identify") {
                const oldName = this.connectionNames.get(sender.id);
                const newName = data.name;
                this.connectionNames.set(sender.id, newName);

                // If this is the first time they identify, log the join
                if (!oldName) {
                    console.log("[party] identify", {
                        room: this.room.id,
                        connId: sender.id,
                        name: newName,
                    });
                    this.logToTerminal(`welcome ${newName}`, "success");
                } else if (oldName !== newName) {
                    // Optional: log name change
                }
            }
        } catch (e) {
            console.warn("[party] onMessage parse failed", {
                room: this.room.id,
                connId: sender.id,
                error: String(e),
            });
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
        const doc = await this.getDoc();
        const terminalSessions = doc.getArray("terminal-sessions");
        terminalSessions.push([
            {
                id: randomUUID(),
                command: "system",
                timestamp: Date.now(),
                logs: [
                    {
                        text,
                        type,
                        timestamp: Date.now(),
                    },
                ],
                status: "completed",
                ownerId: -1,
            },
        ]);
    }

    private async ensureWelcomeMessage() {
        const doc = await this.getDoc();
        const meta = doc.getMap("terminal-meta");
        const terminalSessions = doc.getArray("terminal-sessions");
        if (meta.get("createdAt") || terminalSessions.length > 0) {
            if (!meta.get("createdAt")) {
                meta.set("createdAt", Date.now());
            }
            return;
        }

        const roomCode = this.room.id.replace(/^game-/, "");
        const welcomeMessage =
            `Welcome to room '${roomCode}'!\n\n` +
            "Type 'run' to execute your Python code, control C (^C) to stop execution, " +
            "'help' for available commands, or 'clear' to clear the terminal.";

        terminalSessions.push([
            {
                id: randomUUID(),
                command: "system",
                timestamp: Date.now(),
                logs: [
                    {
                        text: welcomeMessage,
                        type: "info",
                        timestamp: Date.now(),
                    },
                ],
                status: "completed",
                ownerId: -1,
            },
        ]);

        meta.set("createdAt", Date.now());
    }

    private async getDoc() {
        if (!this.yDoc) {
            this.yDoc = await unstable_getYDoc(this.room, this.yjsOptions);
        }
        return this.yDoc;
    }
}
