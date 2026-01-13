<script module lang="ts">
    export const LOADING = Symbol("MonacoLoading");
</script>

<script lang="ts">
    import type * as monaco from "monaco-editor";
    import { onMount } from "svelte";
    import { RemoteCursorManager, RemoteSelectionManager } from "@convergencelabs/monaco-collab-ext";
    import type { Awareness } from "y-protocols/awareness";
    import * as Y from "yjs";

    let container: HTMLDivElement;

    type Props = {
        value?: string | typeof LOADING;
        editor: monaco.editor.IStandaloneCodeEditor | undefined;
        fontSize?: number;
        theme?: "dark" | "light";
        awareness?: Awareness;
        showCursors?: boolean;
    };

    let {
        value = $bindable(LOADING),
        editor = $bindable(undefined),
        fontSize = 14,
        theme = "dark",
        awareness,
        showCursors = true,
    }: Props = $props();

    let cursorManager: RemoteCursorManager | undefined;
    let selectionManager: RemoteSelectionManager | undefined;
    const remoteCursors = new Map<number, any>();
    const remoteSelections = new Map<number, any>();

    function getContrastColor(hex: string): string {
        const c = hex.replace('#', '');
        const r = parseInt(c.slice(0, 2), 16);
        const g = parseInt(c.slice(2, 4), 16);
        const b = parseInt(c.slice(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000' : '#fff';
    }

    function updateTooltipContrast(el: Element) {
        const bg = (el as HTMLElement).style.backgroundColor;
        if (!bg) return;
        const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const hex = '#' + [match[1], match[2], match[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
            (el as HTMLElement).style.color = getContrastColor(hex);
        }
    }

    $effect(() => {
        if (editor) {
            editor.updateOptions({ fontSize });
        }
    });

    $effect(() => {
        // Run whenever showCursors or awareness changes
        if (showCursors !== undefined || awareness !== undefined) {
            updateRemoteCursors();
        }
    });

    let monacoModule: typeof import("monaco-editor") | null = $state(null);

    $effect(() => {
        if (monacoModule && theme) {
            monacoModule.editor.setTheme(theme === "dark" ? "terminal" : "terminal-light");
        }
    });

    function updateRemoteCursors() {
        if (!awareness || !cursorManager || !selectionManager || !editor) return;

        const states = awareness.getStates();
        const clientID = awareness.clientID;

        // Remove cursors for clients that are no longer present
        remoteCursors.forEach((_, id) => {
            if (!states.has(id)) {
                remoteCursors.get(id)?.dispose();
                remoteCursors.delete(id);
                remoteSelections.get(id)?.dispose();
                remoteSelections.delete(id);
            }
        });

        states.forEach((state, id) => {
            if (id === clientID) return;

            const user = state.user;
            if (!user) return;

            // Handle Cursor
            let cursor = remoteCursors.get(id);
            if (!cursor) {
                cursor = cursorManager!.addCursor(id.toString(), user.color, user.name);
                remoteCursors.set(id, cursor);
            }

            // Handle Selection
            let selection = remoteSelections.get(id);
            if (!selection) {
                selection = selectionManager!.addSelection(id.toString(), user.color);
                remoteSelections.set(id, selection);
            }

            if (!showCursors) {
                cursor.hide();
                selection.hide();
                return;
            }

            // Update position if available
            const model = editor!.getModel();
            if (!model) return;

            if (state.cursor) {
                try {
                    const pos = state.cursor;
                    // Validate position is within model bounds
                    const lineCount = model.getLineCount();
                    if (pos.lineNumber <= lineCount) {
                        const lineMaxColumn = model.getLineMaxColumn(pos.lineNumber);
                        if (pos.column <= lineMaxColumn) {
                            const offset = model.getOffsetAt(pos);
                            cursor.setOffset(offset);
                            cursor.show();
                        } else {
                            cursor.hide();
                        }
                    } else {
                        cursor.hide();
                    }
                } catch (e) {
                    cursor.hide();
                }
            } else {
                cursor.hide();
            }

            if (state.selection) {
                try {
                    const sel = state.selection;
                    if (sel.start && sel.end) {
                        const startOffset = model.getOffsetAt(sel.start);
                        const endOffset = model.getOffsetAt(sel.end);
                        selection.setOffsets(startOffset, endOffset);
                        selection.show();
                    } else {
                        selection.hide();
                    }
                } catch (e) {
                    selection.hide();
                }
            } else {
                selection.hide();
            }
        });
    }

    onMount(() => {
        (async () => {
            // Dynamically import workers only on client
            const [
                { default: editorWorker },
                { default: jsonWorker },
                { default: cssWorker },
                { default: htmlWorker },
                { default: tsWorker }
            ] = await Promise.all([
                import("monaco-editor/esm/vs/editor/editor.worker?worker"),
                import("monaco-editor/esm/vs/language/json/json.worker?worker"),
                import("monaco-editor/esm/vs/language/css/css.worker?worker"),
                import("monaco-editor/esm/vs/language/html/html.worker?worker"),
                import("monaco-editor/esm/vs/language/typescript/ts.worker?worker")
            ]);

            self.MonacoEnvironment = {
                getWorker: function (_moduleId: any, label: string) {
                    if (label === "json") {
                        return new jsonWorker();
                    }
                    if (label === "css" || label === "scss" || label === "less") {
                        return new cssWorker();
                    }
                    if (label === "html" || label === "handlebars" || label === "razor") {
                        return new htmlWorker();
                    }
                    if (label === "typescript" || label === "javascript") {
                        return new tsWorker();
                    }
                    return new editorWorker();
                },
            };

            const monaco = await import("monaco-editor");
            monacoModule = monaco;
            
            // ... theme definitions ...

            // Define terminal-matching theme
            monaco.editor.defineTheme("terminal", {
                base: "vs-dark",
                inherit: false,
                rules: [
                    { token: "", foreground: "cccccc", background: "0c0c0c" },
                    { token: "comment", foreground: "666666", fontStyle: "italic" },
                    { token: "keyword", foreground: "00ff41" },
                    { token: "keyword.control", foreground: "00ff41" },
                    { token: "string", foreground: "ffff00" },
                    { token: "number", foreground: "00ffff" },
                    { token: "operator", foreground: "cccccc" },
                    { token: "delimiter", foreground: "cccccc" },
                    { token: "type", foreground: "00ffff" },
                    { token: "function", foreground: "00ff41" },
                    { token: "variable", foreground: "cccccc" },
                    { token: "constant", foreground: "00ffff" },
                    { token: "class", foreground: "00ffff" },
                    { token: "interface", foreground: "00ffff" },
                    { token: "namespace", foreground: "00ffff" },
                    { token: "parameter", foreground: "cccccc" },
                    { token: "property", foreground: "cccccc" },
                    { token: "invalid", foreground: "ff3333" },
                ],
                colors: {
                    "editor.background": "#0c0c0c",
                    "editor.foreground": "#cccccc",
                    "editorCursor.foreground": "#00ff41",
                    "editor.lineHighlightBackground": "#1a1a1a",
                    "editorLineNumber.foreground": "#555555",
                    "editorLineNumber.activeForeground": "#00ff41",
                    "editor.selectionBackground": "#333333",
                    "editor.inactiveSelectionBackground": "#222222",
                    "editorIndentGuide.background": "#333333",
                    "editorIndentGuide.activeBackground": "#555555",
                    "editorBracketMatch.background": "#333333",
                    "editorBracketMatch.border": "#00ff41",
                    "scrollbarSlider.background": "#33333380",
                    "scrollbarSlider.hoverBackground": "#55555580",
                    "scrollbarSlider.activeBackground": "#666666",
                },
            });

            monaco.editor.defineTheme("terminal-light", {
                base: "vs",
                inherit: false,
                rules: [
                    { token: "", foreground: "333333", background: "f5f5f5" },
                    { token: "comment", foreground: "888888", fontStyle: "italic" },
                    { token: "keyword", foreground: "007700" },
                    { token: "string", foreground: "aa5500" },
                    { token: "number", foreground: "0066aa" },
                    { token: "function", foreground: "007700" },
                    { token: "type", foreground: "0066aa" },
                ],
                colors: {
                    "editor.background": "#f5f5f5",
                    "editor.foreground": "#333333",
                    "editorCursor.foreground": "#007700",
                    "editor.lineHighlightBackground": "#e8e8e8",
                    "editorLineNumber.foreground": "#999999",
                    "editorLineNumber.activeForeground": "#007700",
                    "editor.selectionBackground": "#c0e0ff",
                },
            });

            editor = monaco.editor.create(container, {
                value: "# Type your code here",
                language: "python",
                theme: theme === "dark" ? "terminal" : "terminal-light",
                fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                fontSize: fontSize,
                lineHeight: 1.4,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                renderLineHighlight: "line",
                cursorBlinking: "phase",
                cursorStyle: "line",
            });

            if (value !== LOADING) {
                editor.setValue(value);
            }

            editor.onDidChangeCursorSelection((e) => {
                if (awareness) {
                    const selection = editor!.getSelection();
                    if (selection) {
                        awareness.setLocalStateField("cursor", {
                            lineNumber: selection.positionLineNumber,
                            column: selection.positionColumn,
                        });
                        awareness.setLocalStateField("selection", {
                            start: {
                                lineNumber: selection.selectionStartLineNumber,
                                column: selection.selectionStartColumn,
                            },
                            end: {
                                lineNumber: selection.positionLineNumber,
                                column: selection.positionColumn,
                            },
                        });
                    }
                }
            });

            editor.onDidChangeModelContent(() => {
                value = editor!.getValue();
            });

            // Initialize collaborative managers
            cursorManager = new RemoteCursorManager({ 
                editor: editor!,
                tooltips: true,
                tooltipDuration: 4 // Keep label visible for 4 seconds after movement
            });
            selectionManager = new RemoteSelectionManager({ editor: editor! });

            if (awareness) {
                awareness.on("change", updateRemoteCursors);
                updateRemoteCursors();
            }

            // Watch for tooltip elements and update their text color for contrast
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node instanceof Element) {
                            if (node.classList.contains('monaco-remote-cursor-tooltip')) {
                                updateTooltipContrast(node);
                            }
                            node.querySelectorAll('.monaco-remote-cursor-tooltip').forEach(updateTooltipContrast);
                        }
                    });
                });
            });
            observer.observe(container, { childList: true, subtree: true });

            return () => {
                observer.disconnect();
            };
        })();

        return () => {
            if (awareness) {
                awareness.off("change", updateRemoteCursors);
            }
            remoteCursors.forEach(c => c.dispose());
            remoteSelections.forEach(s => s.dispose());
            editor?.dispose();
        };
    });
</script>

<div class="monaco-editor" bind:this={container}></div>

<style>
    .monaco-editor {
        width: 100%;
        height: 100%;
    }

    /* Monaco Collab Ext Styles */
    :global(.monaco-remote-cursor) {
        width: 2px !important;
        z-index: 100 !important;
    }

    :global(.monaco-remote-selection) {
        opacity: 0.2;
    }

    :global(.monaco-remote-cursor-tooltip) {
        font-family: var(--term-font) !important;
        font-size: 10px !important;
        padding: 1px 4px !important;
        position: absolute !important;
        white-space: nowrap !important;
        font-weight: bold !important;
        pointer-events: none !important;
        z-index: 101 !important;
        border-radius: 0 !important;
        line-height: normal !important;
        box-shadow: 2px 2px 0 rgba(0,0,0,0.5);
    }

    /* Hide the default small triangle/flag if it exists to keep it clean */
    :global(.monaco-remote-cursor:before) {
        display: none !important;
    }
</style>
