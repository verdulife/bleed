<script lang="ts">
	import { userFiles } from '@/lib/stores';
	import { getFileType, inputFileAsync } from '@/lib/utils';

	async function addFiles() {
		const files = await inputFileAsync();

		Array.from(files).forEach(async (file) => {
			const fileType = getFileType(file);
			const fileBuffer = await file.arrayBuffer();

			$userFiles.push({ fileType, fileBuffer });
			$userFiles = $userFiles;
		});
	}
</script>

<button
	on:click={addFiles}
	class="w-full bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700 transition-colors"
>
	Add Images/PDF's
</button>
