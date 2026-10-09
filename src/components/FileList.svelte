<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import type { DndEvent } from 'svelte-dnd-action';
	import { userFiles, manualOrder } from '@/lib/stores';
	import type { UserFile } from '@/lib/types';
	import FileCard from '@/components/FileCard.svelte';

	/**
	 * `consider` fires every time the dragged row needs room at a new position (and once
	 * on drag start). Following it into the store is what renders the live preview, so
	 * the list on screen is never a stale copy of the in-flight drag.
	 */
	function handleConsider(event: CustomEvent<DndEvent<UserFile>>) {
		userFiles.set(event.detail.items);
	}

	/**
	 * `finalize` fires on drop with the settled list. Committing it is required by the
	 * library, and it is also the moment the user's order becomes explicit: from now on
	 * new files append instead of merging alphabetically.
	 */
	function handleFinalize(event: CustomEvent<DndEvent<UserFile>>) {
		userFiles.set(event.detail.items);
		manualOrder.set(true);
	}

	function removeFile(id: number) {
		const remaining = $userFiles.filter((file) => file.id !== id);
		$userFiles = remaining;
		// Removing the last file leaves no order to preserve either, so the next add must be
		// alphabetical again (same rule as "remove all files" in `InputFile.svelte`).
		if (!remaining.length) manualOrder.set(false);
	}
</script>

<ul
	use:dndzone={{
		items: $userFiles,
		// The library defaults to a 2px yellow outline that fights the design; an empty
		// style object neutralises it through the library's own option (`!important`
		// would have to fight inline styles, which the library sets).
		dropTargetStyle: {}
	}}
	on:consider={handleConsider}
	on:finalize={handleFinalize}
	class="flex max-h-48 w-full flex-col overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-800"
>
	{#each $userFiles as file (file.id)}
		<FileCard {file} {removeFile}></FileCard>
	{/each}
</ul>
