import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [vitePreprocess({})],

	kit: {
		alias: {
			'@/*': './src/*'
		},
		// Explicit Vercel adapter. `adapter-auto` used to pull in `@sveltejs/adapter-vercel@4`,
		// whose runtime mapping only knew Node 18 and 20; Vercel disabled Node 20 builds on
		// 2026-10-01 and the deploy failed with "Unsupported Node.js version: v24.21.0".
		// The runtime is pinned on purpose: the adapter otherwise derives it from the Node that
		// runs the build (`nodejs${major}.x`), which would emit a runtime Vercel does not offer
		// when the build runs on a newer local Node.
		adapter: adapter({ runtime: 'nodejs24.x' })
	}
};

export default config;
