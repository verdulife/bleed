<script lang="ts">
	export let x: number;
	export let y: number;
</script>

<fieldset class="flex flex-col gap-2">
	<header class="flex items-end justify-between">
		<h3 class="text-xs font-semibold text-gray-400"><slot /></h3>
	</header>

	<div class="flex gap-2">
		<div class="flex w-1/2 rounded-md bg-white/10">
			<input type="number" id="width" bind:value={x} class=" w-full bg-transparent p-3 text-sm" />
			<span
				class="grid aspect-square h-full place-content-center bg-black/30 p-3 text-xs text-gray-400"
			>
				x
			</span>
		</div>

		<div class="flex w-1/2 rounded-md bg-white/10">
			<input type="number" id="height" bind:value={y} class="w-full bg-transparent p-3 text-sm" />
			<span
				class="grid aspect-square h-full place-content-center bg-black/30 p-3 text-xs text-gray-400"
			>
				y
			</span>
		</div>
	</div>
</fieldset>
