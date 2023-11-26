<script lang="ts">
	import { inputFileAsync, pushFilesToStore } from '@/lib/file-helpers';
	import FileList from '@/components/FileList.svelte';

	async function addFiles() {
		const files = await inputFileAsync();
		await pushFilesToStore(files);
	}
</script>

	<fieldset class="flex flex-col gap-2 items-start w-full">
		<h3 class="font-semibold text-xs text-gray-400 whitespace-nowrap">Add images or PDF's</h3>

		<button
			on:click={addFiles}
			class="w-full border-2 border-dashed border-slate-800 p-4 rounded hover:bg-slate-800/30 text-slate-500 hover:text-slate-300 transition-colors"
		>
			Select or drop files
		</button>

		<FileList></FileList>
	</fieldset>
