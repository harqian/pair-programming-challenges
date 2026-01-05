<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { settings } from "$lib/settings";

	let { children } = $props();

	$effect(() => {
		document.documentElement.classList.toggle("light", $settings.theme === "light");
		document.body.classList.toggle("light", $settings.theme === "light");
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: "Inter", sans-serif;
		background-color: #0f172a;
		color: #e0e0e0;
	}

	:global(:root) {
		--term-bg: #0c0c0c;
		--term-session-bg: #000000;
		--term-border: #333333;
		--term-text: #cccccc;
		--term-green: #00ff41;
		--term-cyan: #00ffff;
		--term-red: #ff3333;
		--term-yellow: #ffff00;
		--term-font: "Consolas", "Monaco", "Courier New", monospace;
		--resize-bg: #222222;
		--resize-handle: #444444;
		--resize-hover-bg: #333333;
		--resize-hover-handle: #666666;
	}

	:global(:root.light) {
		--term-bg: #f5f5f5;
		--term-session-bg: #ffffff;
		--term-border: #cccccc;
		--term-text: #333333;
		--term-green: #007700;
		--term-cyan: #0066aa;
		--term-red: #cc0000;
		--term-yellow: #aa5500;
		--resize-bg: #e2e8f0;
		--resize-handle: #cbd5e1;
		--resize-hover-bg: #cbd5e1;
		--resize-hover-handle: #94a3b8;
	}

	:global(body.light) {
		background-color: #e8e8e8;
		color: #333333;
	}

	:global(.inline-error-message) {
		color: #f48771;
		font-style: italic;
		margin-left: 0.5em;
	}

	:global(.error-line-highlight) {
		background-color: rgba(255, 0, 0, 0.1);
	}

	:global(.error-glyph) {
		background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="%23f48771"/><text x="8" y="11" text-anchor="middle" font-size="10" fill="white" font-weight="bold">✕</text></svg>')
			center center no-repeat;
		width: 16px;
	}
</style>
