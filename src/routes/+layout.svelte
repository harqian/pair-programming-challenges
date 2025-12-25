<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";

	let { children } = $props();
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
	}
</style>
