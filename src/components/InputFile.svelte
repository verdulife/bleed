<script lang="ts">
	import { userFiles } from '@/lib/stores';
	import { inputFileAsync, pushFilesToStore } from '@/lib/file-helpers';
	import OptionBox from './OptionBox.svelte';

	async function addFiles() {
		const files = await inputFileAsync();
		await pushFilesToStore(files);
	}
</script>

<OptionBox>
	<fieldset class="flex flex-col gap-2">
		<h3 class="font-semibold text-xs text-gray-400 whitespace-nowrap">Add images or PDF's</h3>

		<button
			on:click={addFiles}
			class="border-2 border-dashed border-slate-800 p-4 rounded hover:bg-slate-800/30 text-slate-500 hover:text-slate-300 transition-colors"
		>
			Select or drop files
		</button>

		<ul class="flex flex-col max-h-48 overflow-y-auto overflow-x-hidden">
			{#each $userFiles as { fileName }}
				<li class="flex p-2 border-b last:border-b-0 border-slate-400">
					<p
						class="font-semibold text-xs text-gray-400 whitespace-nowrap text-ellipsis overflow-hidden max-w-[200px]"
					>
						{fileName}
					</p>
				</li>
			{/each}
		</ul>
	</fieldset>
</OptionBox>
