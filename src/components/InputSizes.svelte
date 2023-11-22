<script>
	import { userSettings } from '@/lib/stores';
</script>

<fieldset class="flex flex-col">
	<label for="width">
		Width in mm
		<input type="number" id="width" bind:value={$userSettings.width} class="text-black" />
	</label>

	<label for="height">
		Height in mm
		<input type="number" id="height" bind:value={$userSettings.height} class="text-black" />
	</label>
</fieldset>
