<script lang="ts">
	import { pushFilesToStore } from '@/lib/file-helpers';

	let isDragOver = false;

	/**
	 * This wrapper handles operating-system file drops for the whole page, so in-page drags
	 * (dragging selected text, a link, or anything that is not a file) must not reach it.
	 * Only a `dataTransfer` that actually carries files activates the overlay or the ingestion.
	 */
	function carriesFiles(event: DragEvent): boolean {
		return !!event.dataTransfer?.types.includes('Files');
	}

	function handleDragOver(event: DragEvent) {
		if (!carriesFiles(event)) return;
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	async function handleDrop(event: DragEvent) {
		handleDragLeave();
		const dataTransfer = event.dataTransfer;
		if (!dataTransfer?.files.length) return;

		const files = dataTransfer.files;
		console.log('todo: check if files are pdf or image', files);

		await pushFilesToStore(files);
	}
</script>

<button
	on:dragover|preventDefault={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop|preventDefault={handleDrop}
	class="h-full w-full cursor-default"
>
	<slot />

	<section
		class="pointer-events-none absolute inset-0 opacity-0 transition-opacity"
		class:opacity-100={isDragOver}
	>
		<article class="h-full bg-blue-600/10 p-10 lg:p-20">
			<span
				class="grid h-full place-content-center rounded-xl border-2 border-dashed border-blue-600 bg-blue-600/40 text-2xl backdrop-blur"
			>
				Drop your files
			</span>
		</article>
	</section>
</button>
