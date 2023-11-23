<script lang="ts">
	import { previewBlobUri } from '@/lib/stores';
</script>

<object
	data={$previewBlobUri}
	type="application/pdf"
	title="Preview PDF"
	class="bg-slate-900 flex flex-col items-center justify-center w-full h-full gap-4 rounded-xl"
>
	<p class="text-center text-2xl font-semibold">An error occurred <br />creating the PDF</p>
	<a
		data-sveltekit-reload
		href="/"
		class="bg-blue-500 text-white px-12 py-2 rounded hover:bg-blue-700 transition-colors text-center"
	>
		Reload
	</a>
</object>
