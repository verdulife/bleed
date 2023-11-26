<script lang="ts">
	import type { UserFile } from '@/lib/types';
	import { FILE_TYPE } from '@/lib/constants';
	import Jpg from '@/icons/Jpg.svelte';
	import Png from '@/icons/Png.svelte';
	import Pdf from '@/icons/Pdf.svelte';
	import Trash from '@/icons/Trash.svelte';

	export let file: UserFile;
	export let removeFile: Function;

	const { fileName, fileType, id } = file;
	const [name] = fileName.split('.');
</script>

<li class="p-2 border-b last:border-b-0 border-slate-900 w-full">
	<article class="relative flex items-center justify-start gap-2 w-full overflow-hidden text-left">
		<button class="cursor-move text-gray-500">
			{#if fileType === FILE_TYPE.JPEG}
				<Jpg />
			{:else if fileType === FILE_TYPE.PNG}
				<Png />
			{:else}
				<Pdf />
			{/if}
		</button>

		<p class="font-semibold text-xs text-gray-400 whitespace-nowrap text-ellipsis overflow-hidden max-w-[150px]">
			{name}
		</p>

		<button on:click={() => removeFile(id)} class=" text-gray-600 ml-auto">
			<Trash />
		</button>
	</article>
</li>
