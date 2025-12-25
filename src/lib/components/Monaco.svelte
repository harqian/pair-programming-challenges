<script module lang="ts">
    import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
    import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
    import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
    import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
    import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

    self.MonacoEnvironment = {
        getWorker: function (_moduleId: any, label: string) {
            if (label === "json") {
                return new jsonWorker();
            }
            if (label === "css" || label === "scss" || label === "less") {
                return new cssWorker();
            }
            if (
                label === "html" ||
                label === "handlebars" ||
                label === "razor"
            ) {
                return new htmlWorker();
            }
            if (label === "typescript" || label === "javascript") {
                return new tsWorker();
            }
            return new editorWorker();
        },
    };

    export const LOADING = Symbol("MonacoLoading");
</script>

<script lang="ts">
    import type * as monaco from "monaco-editor";
    import { onMount } from "svelte";

    let container: HTMLDivElement;

    type Props = {
        value?: string | typeof LOADING;
        editor: monaco.editor.IStandaloneCodeEditor | undefined;
    };

    let { value = $bindable(LOADING), editor = $bindable(undefined) }: Props =
        $props();

    $effect(() => {
        if (editor !== undefined && value !== LOADING) {
            if (editor.getValue() !== value) {
                editor.setValue(value);
            }
        }
    });

    onMount(() => {
        (async () => {
            const monaco = await import("monaco-editor");

            editor = monaco.editor.create(container, {
                value: "# Type your code here",
                language: "python",
            });

            if (value !== LOADING) {
                editor.setValue(value);
            }

            editor.onDidChangeModelContent(() => {
                value = editor!.getValue();
            });
        })();

        return () => {
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
</style>
