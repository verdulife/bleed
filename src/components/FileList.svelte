<script lang="ts">
	import { userFiles } from '@/lib/stores';
	import FileCard from '@/components/FileCard.svelte';

	function removeFile(id: number) {
		$userFiles = $userFiles.filter((file) => file.id !== id);
	}
</script>

<ul
	class="flex max-h-48 w-full flex-col overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-800"
>
	{#key $userFiles}
		{#each $userFiles as file}
			<FileCard {file} {removeFile}></FileCard>
		{/each}
	{/key}
</ul>
