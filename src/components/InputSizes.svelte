<script>
	import { userSettings } from '@/lib/stores';
</script>

<fieldset class="flex flex-col gap-1">
	<h3 class="font-semibold text-xs text-gray-400">Width by height</h3>

	<div class="flex gap-2">
		<div class="w-1/2 flex bg-white/10 rounded-md">
			<input
				type="number"
				id="width"
				bind:value={$userSettings.width}
				class=" p-2 w-full bg-transparent"
			/>
			<span class="p-2 bg-black/30 text-xs text-gray-400 grid place-content-center">mm</span>
		</div>

		<div class="w-1/2 flex bg-white/10 rounded-md">
			<input
				type="number"
				id="height"
				bind:value={$userSettings.height}
				class=" p-2 w-full bg-transparent"
			/>
			<span class="p-2 bg-black/30 text-xs text-gray-400 grid place-content-center">mm</span>
		</div>
	</div>
</fieldset>
