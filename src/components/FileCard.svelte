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

<li class="w-full border-b border-slate-900 p-2 last:border-b-0">
	<article class="relative flex w-full items-center justify-start gap-2 overflow-hidden text-left">
		<button class=" text-gray-500">
			{#if fileType === FILE_TYPE.JPEG}
				<Jpg />
			{:else if fileType === FILE_TYPE.PNG}
				<Png />
			{:else}
				<Pdf />
			{/if}
		</button>

		<p
			class="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-gray-400"
		>
			{name}
		</p>

		<button
			on:click={() => removeFile(id)}
			class="ml-auto text-gray-600 transition-colors hover:text-red-500/80"
		>
			<Trash />
		</button>
	</article>
</li>
