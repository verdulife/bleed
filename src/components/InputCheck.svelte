<script lang="ts">
	export let setting: number;

	function toggleState() {
		setting = setting === 0 ? 1 : 0;
	}
</script>

<button on:click={toggleState} class="flex justify-between items-center gap-1 w-full">
	<h3 class="font-semibold text-xs text-gray-400"><slot /></h3>

	<input
		type="range"
		bind:value={setting}
		min={0}
		max={1}
		step="1"
		class="w-6 scale-110 pointer-events-none"
	/>
</button>
