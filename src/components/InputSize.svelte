<script lang="ts">
	export let setting: number;
</script>

<fieldset class="flex justify-between items-center gap-2 w-full">
	<h3 class="font-semibold text-xs text-gray-400 whitespace-nowrap"><slot /></h3>

	<div class="w-1/3 flex bg-white/10 rounded-md">
		<input
			type="number"
			id="bleedSize"
			min={0}
			max={10}
			step="1"
			bind:value={setting}
			class=" p-3 w-full bg-transparent text-sm"
		/>
		<span class="p-3 bg-black/30 text-xs text-gray-400 grid place-content-center">mm</span>
	</div>
</fieldset>
