<script lang="ts">
	import { userFiles } from '@/lib/stores';
	import { getFileType, inputFileAsync } from '@/lib/file-helpers';
	import OptionBox from './OptionBox.svelte';

	let isDragOver = false;
	let buttonMessage = 'Select or drop files';

	function pushFilesToStore(files: FileList) {
		Array.from(files).forEach(async (file: File) => {
			const fileType = getFileType(file);
			const fileBuffer = await file.arrayBuffer();
			const fileName = file.name;

			$userFiles.push({ fileType, fileBuffer, fileName });
			$userFiles = $userFiles;
		});
	}

	function handleDragOver() {
		buttonMessage = 'Drop it';
		isDragOver = true;
	}

	function handleDragLeave() {
		buttonMessage = 'Select or drop files';
		isDragOver = false;
	}

	function handleDrop(event: DragEvent) {
		handleDragLeave();
		if (!event.dataTransfer) return;

		const files = event.dataTransfer.files;
		pushFilesToStore(files);
	}

	async function addFiles() {
		const files = await inputFileAsync();
		pushFilesToStore(files);
	}
</script>

<OptionBox>
	<fieldset class="flex flex-col gap-2">
		<h3 class="font-semibold text-xs text-gray-400 whitespace-nowrap">Add images or PDF's</h3>

		<button
			on:click={addFiles}
			on:dragover|preventDefault={handleDragOver}
			on:dragleave={handleDragLeave}
			on:drop|preventDefault={handleDrop}
			class="border-2 border-dashed border-slate-800 p-4 rounded hover:bg-slate-800/30 text-slate-500 hover:text-slate-300 transition-colors"
			class:bg-blue-700={isDragOver}
		>
			{buttonMessage}
		</button>

		<ul class="flex flex-col max-h-48 overflow-y-auto overflow-x-hidden">
			{#each $userFiles as { fileName }}
				<li class="flex p-2 border-b last:border-b-0 border-slate-800">
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
