<script>
	import { userSettings } from '@/lib/stores';

	function limitBleedSize() {
		if ($userSettings.bleedSize > 10) $userSettings.bleedSize = 10;
		else if ($userSettings.bleedSize < 2) $userSettings.bleedSize = 2;
	}
</script>

<fieldset class="flex justify-between items-center gap-2 w-full">
	<h3 class="font-semibold text-xs text-gray-400 whitespace-nowrap">Bleed size</h3>

	<div class="w-1/3 flex bg-white/10 rounded-md">
		<input
			type="number"
			id="bleedSize"
			min={0}
			max={10}
			step="1"
			bind:value={$userSettings.bleedSize}
			on:change={limitBleedSize}
			class=" p-2 w-full bg-transparent"
		/>
		<span class="p-2 bg-black/30 text-xs text-gray-400 grid place-content-center">mm</span>
	</div>
</fieldset>
