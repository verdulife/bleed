<script lang="ts">
	import Selector from '@/icons/Selector.svelte';
	import { SIZE_PRESETS } from '@/lib/constants';

	export let setting: { width: number; height: number };
	let selectedSize: { width: number; height: number };

	function changeSize() {
		setTimeout(() => {
			setting = selectedSize;
		});
	}
</script>

<fieldset class="flex w-full flex-col items-start justify-between gap-2">
	<h3 class="whitespace-nowrap text-xs font-semibold text-gray-400"><slot /></h3>

	<div class="relative w-full">
		<select
			class="flex w-full appearance-none rounded-md bg-white/10 p-3 text-sm"
			bind:value={selectedSize}
			on:change={changeSize}
		>
			<option value="" class="bg-slate-950">Select a preset</option>
			{#each Object.entries(SIZE_PRESETS).reverse() as [key, value]}
				<option {value} class="bg-slate-950">{key} ({value.width} x {value.height}mm)</option>
			{/each}
		</select>

		<Selector class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
	</div>
</fieldset>
