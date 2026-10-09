<script lang="ts">
	import { generationErrors } from '@/lib/stores';
</script>

{#if $generationErrors.length}
	<div
		role="alert"
		class="flex w-full flex-col gap-1 rounded-lg border-l-2 border-red-500/60 bg-red-500/10 p-3 text-xs text-red-400"
	>
		<p class="font-semibold">Problems while generating the PDF</p>
		<ul class="flex flex-col gap-0.5">
			{#each $generationErrors as error}
				<li>{error}</li>
			{/each}
		</ul>
	</div>
{/if}
