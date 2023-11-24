<script>
	import { userFiles } from '@/lib/stores';
	import FileCard from './FileCard.svelte';
</script>

<ul class="flex flex-col max-h-48 overflow-y-auto overflow-x-hidden">
	{#each $userFiles as file}
		<FileCard {file}></FileCard>
	{/each}
</ul>
