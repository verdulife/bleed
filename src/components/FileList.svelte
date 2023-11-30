<script lang="ts">
	import { userFiles } from '@/lib/stores';
	import FileCard from '@/components/FileCard.svelte';

	function removeFile(id: number) {
		$userFiles.filter((file) => file.id !== id);
	}
</script>

<ul
	class="flex flex-col max-h-48 overflow-y-auto overflow-x-hidden w-full scrollbar-thin scrollbar-thumb-slate-900 scrollbar-thumb-rounded-full"
>
	{#each $userFiles as file}
		<FileCard {file} bind:removeFile></FileCard>
	{/each}
</ul>
