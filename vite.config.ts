import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		exclude: ["monaco-editor"]
	},
	assetsInclude: ['**/*.ttf'],
	ssr: {
		noExternal: [],
		external: ['monaco-editor']
	}
});
