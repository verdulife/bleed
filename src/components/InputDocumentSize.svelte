<script>
	import { bleedSettings } from '@/lib/stores';
	import Switch from '@/icons/Switch.svelte';

	function switchSizes() {
		const { width, height } = $bleedSettings.document;

		$bleedSettings.document.width = height;
		$bleedSettings.document.height = width;
	}
</script>

<fieldset class="flex flex-col gap-2">
	<header class="flex justify-between items-end">
		<h3 class="font-semibold text-xs text-gray-400">Document size</h3>

		<button on:click={switchSizes} class="px-1">
			<Switch></Switch>
		</button>
	</header>

	<div class="flex gap-2">
		<div class="w-1/2 flex bg-white/10 rounded-md">
			<input
				type="number"
				id="width"
				bind:value={$bleedSettings.document.width}
				class=" p-2 w-full bg-transparent"
			/>
			<span class="p-2 bg-black/30 text-xs text-gray-400 grid place-content-center">mm</span>
		</div>

		<div class="w-1/2 flex bg-white/10 rounded-md">
			<input
				type="number"
				id="height"
				bind:value={$bleedSettings.document.height}
				class=" p-2 w-full bg-transparent"
			/>
			<span class="p-2 bg-black/30 text-xs text-gray-400 grid place-content-center">mm</span>
		</div>
	</div>
</fieldset>
