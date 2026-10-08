<script lang="ts">
	import { inputFileAsync, pushFilesToStore } from '@/lib/file-helpers';
	import { userFiles } from '@/lib/stores';

	import FileList from '@/components/FileList.svelte';
	import Trash from '@/icons/Trash.svelte';

	async function addFiles() {
		const files = await inputFileAsync();
		await pushFilesToStore(files);
	}

	function removeFiles() {
		const check = confirm('Are you sure you want to remove all files?');
		if (!check) return;

		$userFiles = [];
	}
</script>

<fieldset class="flex w-full flex-col items-start gap-2">
	<div class="flex w-full items-center justify-between text-xs font-semibold text-gray-400">
		<h3>Add images or PDF's</h3>

		{#if $userFiles.length}
			<button
				on:click={removeFiles}
				class="flex items-center gap-1 rounded-full border border-gray-900 bg-gray-800 px-2 py-1 transition-colors hover:border-red-500/80 hover:text-red-500/80"
			>
				{$userFiles.length} files <Trash class="size-3"></Trash>
			</button>
		{/if}
	</div>

	<button
		on:click={addFiles}
		class="w-full rounded border-2 border-dashed border-slate-800 p-4 text-slate-500 transition-colors hover:bg-slate-800/30 hover:text-slate-300"
	>
		Select or drop files
	</button>

	<FileList></FileList>
</fieldset>
