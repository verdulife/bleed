<script lang="ts">
	import { previewBlobUri } from '@/lib/stores';
</script>

<object
	data={$previewBlobUri}
	type="application/pdf"
	title="Preview PDF"
	class="flex h-full w-full flex-col items-center justify-center gap-4 rounded-xl bg-slate-900"
>
	<p class="text-center text-2xl font-semibold">An error occurred <br />creating the PDF</p>
	<a
		data-sveltekit-reload
		href="/"
		class="rounded bg-blue-500 px-12 py-2 text-center text-white transition-colors hover:bg-blue-700"
	>
		Reload
	</a>
</object>
