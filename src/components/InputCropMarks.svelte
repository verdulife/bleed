<script>
	import { userSettings } from '@/lib/stores';
</script>

<fieldset class="flex items-center gap-1">
	<h3 class="font-semibold text-xs text-gray-400 whitespace-nowrap w-full">Add cropmarks</h3>

	<input type="range" bind:value={$userSettings.cropMarks} min={0} max={1} class="w-8 cursor-pointer" />
</fieldset>
