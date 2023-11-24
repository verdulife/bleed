<script>
	import { userSettings } from '@/lib/stores';
	import OptionBox from '@/components/OptionBox.svelte';
	import InputMirrorBleed from './InputMirrorBleed.svelte';

	function toggleState() {
		$userSettings.cropMarksAndBleed = $userSettings.cropMarksAndBleed === 0 ? 1 : 0;
		$userSettings.mirrorBleed = 0;
	}
</script>

<OptionBox>
	<div class="flex flex-col gap-5">
		<button on:click={toggleState} class="flex justify-between items-center gap-1 w-full">
			<h3 class="font-semibold text-xs text-gray-400">Crop marks and bleed</h3>

			<input
				type="range"
				bind:value={$userSettings.cropMarksAndBleed}
				min={0}
				max={1}
				step="1"
				class="w-6 scale-110 pointer-events-none"
			/>
		</button>

		{#if $userSettings.cropMarksAndBleed}
			<!-- <InputBleedSize /> -->
			<InputMirrorBleed />
		{/if}
	</div>
</OptionBox>
