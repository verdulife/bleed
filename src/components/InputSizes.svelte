<script lang="ts">
	import Switch from '@/icons/Switch.svelte';

	export let setting: { width: number; height: number };

	function switchSizes() {
		const { width, height } = setting;

		setting.width = height;
		setting.height = width;
	}
</script>

<fieldset class="flex flex-col gap-2">
	<header class="flex justify-between items-end">
		<h3 class="font-semibold text-xs text-gray-400"><slot /></h3>

		<button on:click={switchSizes} class="px-1">
			<Switch></Switch>
		</button>
	</header>

	<div class="flex gap-2">
		<div class="w-1/2 flex bg-white/10 rounded-md">
			<input
				type="number"
				id="width"
				bind:value={setting.width}
				class=" p-3 w-full bg-transparent text-sm"
			/>
			<span class="p-3 bg-black/30 text-xs text-gray-400 grid place-content-center">mm</span>
		</div>

		<div class="w-1/2 flex bg-white/10 rounded-md">
			<input
				type="number"
				id="height"
				bind:value={setting.height}
				class="p-3 w-full bg-transparent text-sm"
			/>
			<span class="p-3 bg-black/30 text-xs text-gray-400 grid place-content-center">mm</span>
		</div>
	</div>
</fieldset>
