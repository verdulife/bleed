<script lang="ts">
	import { pushFilesToStore } from '@/lib/file-helpers';

	let isDragOver = false;

	function handleDragOver() {
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	async function handleDrop(event: DragEvent) {
		handleDragLeave();
		if (!event.dataTransfer) return;

		const files = event.dataTransfer.files;
		await pushFilesToStore(files);
	}
</script>

<button
	on:dragover|preventDefault={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop|preventDefault={handleDrop}
	class="w-full h-full"
>
	<slot />

	<section class="absolute inset-0 pointer-events-none opacity-0 transition-opacity" class:opacity-100={isDragOver}>
		<article class="h-full bg-blue-600/10 p-10 lg:p-20">
			<span
				class="grid place-content-center h-full bg-blue-600/40 backdrop-blur text-2xl rounded-xl border-2 border-dashed border-blue-600"
			>
				Drop your files
			</span>
		</article>
	</section>
</button>
