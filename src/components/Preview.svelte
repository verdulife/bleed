<script lang="ts">
	import { previewBlobUri } from '@/lib/stores';
	$: data = $previewBlobUri ? `${$previewBlobUri}#view=Fit` : '';
</script>

<!-- The preview shell. The dark container is shared by both states so nothing moves when the
     document appears. Before the first run the state is neutral: nothing failed, there is
     simply nothing to show yet, so there is no error wording and nothing to reload. The
     `<object>` fallback is only reachable when a document does exist but the browser cannot
     embed it, and even then it says so instead of claiming the PDF failed to generate. -->
{#if $previewBlobUri}
	<object
		{data}
		type="application/pdf"
		title="Preview PDF"
		class="flex size-full flex-col items-center justify-center gap-4 rounded-xl bg-slate-900"
	>
		<p class="text-center text-2xl font-semibold">This PDF cannot be displayed in the browser</p>
		<a
			data-sveltekit-reload
			href="/"
			class="rounded bg-blue-500 px-12 py-2 text-center text-white transition-colors hover:bg-blue-700"
		>
			Reload
		</a>
	</object>
{:else}
	<div class="flex size-full flex-col items-center justify-center gap-4 rounded-xl bg-slate-900">
		<p class="text-center text-2xl font-semibold text-slate-500">No document generated yet</p>
	</div>
{/if}
