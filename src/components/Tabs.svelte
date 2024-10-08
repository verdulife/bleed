<script lang="ts">
	export let tab: 'bleeder' | 'repeater';
</script>

<fieldset class="grid w-full grid-cols-2 gap-2 [&>label]:cursor-not-allowed" title="COMING SOON">
	<label
		class="col-span-1 flex cursor-pointer rounded-md bg-white/10 transition-colors"
		class:bg-blue-950={tab === 'bleeder'}
	>
		<input type="radio" id="tab_bleeder" value="bleeder" bind:group={tab} class="hidden" />
		<span
			class="w-full p-3 text-center text-xs text-gray-200 transition-colors"
			class:text-gray-400={tab !== 'bleeder'}
		>
			Bleeder
		</span>
	</label>

	<label
		class="col-span-1 flex cursor-pointer rounded-md bg-white/10 transition-colors"
		class:bg-blue-950={tab === 'repeater'}
	>
		<input type="radio" id="tab_repeater" value="repeater" bind:group={tab} class="hidden" />
		<span
			class="w-full p-3 text-center text-xs text-gray-400"
			class:text-gray-400={tab !== 'repeater'}
		>
			Repeater
		</span>
	</label>
</fieldset>
