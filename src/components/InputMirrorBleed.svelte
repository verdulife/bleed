<script>
	import { userSettings } from '@/lib/stores';
	import OptionBox from '@/components/OptionBox.svelte';

	function toggleState() {
		$userSettings.mirrorBleed = $userSettings.mirrorBleed === 0 ? 1 : 0;
	}
</script>

<OptionBox>
	<button on:click={toggleState} class="flex justify-between items-center gap-1 w-full">
		<h3 class="font-semibold text-xs text-gray-400">Create mirror bleed</h3>

		<input
			type="range"
			bind:value={$userSettings.mirrorBleed}
			min={0}
			max={1}
			step="1"
			class="w-6 scale-110 cursor-pointer"
		/>
	</button>
</OptionBox>
