<script lang="ts">
	import type { UserFile } from '@/lib/types';
	import { FILE_TYPE } from '@/lib/constants';
	import Jpg from '@/icons/Jpg.svelte';
	import Png from '@/icons/Png.svelte';
	import Pdf from '@/icons/Pdf.svelte';
	import Trash from '@/icons/Trash.svelte';

	export let file: UserFile;

	const { fileName, fileType } = file;
	const [name] = fileName.split('.');

	function removePage() {
		console.log(file);
	}
</script>

<li class="p-2 border-b last:border-b-0 border-slate-900">
	<article class="relative flex items-center gap-2 max-w-[200px]">
		<button class="cursor-move">
			{#if fileType === FILE_TYPE.JPEG}
				<Jpg />
			{:else if fileType === FILE_TYPE.PNG}
				<Png />
			{:else}
				<Pdf />
			{/if}
		</button>

		<p class="font-semibold text-xs text-gray-400 whitespace-nowrap text-ellipsis overflow-hidden">
			{name}
		</p>

		<button on:click={removePage} class="absolute right-2 text-gray-600">
			<Trash />
		</button>
	</article>
</li>
