<script lang="ts">
	import { userFiles } from '@/lib/stores';
	import FileCard from '@/components/FileCard.svelte';

	function removeFile(id: number) {
		$userFiles = $userFiles.filter((file) => file.id !== id);
	}
</script>

<ul
	class="flex flex-col max-h-48 overflow-y-auto overflow-x-hidden w-full scrollbar-thin scrollbar-thumb-slate-900 scrollbar-thumb-rounded-full"
>
	{#key $userFiles}
		{#each $userFiles as file}
			<FileCard {file} {removeFile}></FileCard>
		{/each}
	{/key}
</ul>
