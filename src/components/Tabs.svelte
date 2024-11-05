<script lang="ts">
	export let tab: 'bleed' | 'repeat';
</script>

<fieldset class="grid w-full grid-cols-2 gap-2">
	<label
		class="col-span-1 flex cursor-pointer rounded-md bg-white/10 transition-colors"
		class:bg-blue-950={tab === 'bleed'}
	>
		<input type="radio" id="tab_bleed" value="bleed" bind:group={tab} class="hidden" />
		<span
			class="w-full p-3 text-center text-xs text-gray-200 transition-colors"
			class:text-gray-400={tab !== 'bleed'}
		>
			Bleed
		</span>
	</label>

	<label
		class="col-span-1 flex cursor-pointer rounded-md bg-white/10 transition-colors"
		class:bg-blue-950={tab === 'repeat'}
	>
		<input type="radio" id="tab_repeat" value="repeat" bind:group={tab} class="hidden" />
		<span
			class="w-full p-3 text-center text-xs text-gray-400"
			class:text-gray-400={tab !== 'repeat'}
		>
			Repeat
		</span>
	</label>
</fieldset>
