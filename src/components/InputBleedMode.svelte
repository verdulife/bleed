<script lang="ts">
	import type { BleedMode } from '@/lib/types';

	export let setting: BleedMode;

	/**
	 * The third choice is the whole point of this control: the bleed fill used to be a
	 * checkbox that only worked together with crop marks, so it could not say "fill the
	 * bleed area, leave the marks off" (and vice versa).
	 */
	const modes: Array<{ value: BleedMode; label: string }> = [
		{ value: 'none', label: 'No bleed' },
		{ value: 'mirror', label: 'Mirror' },
		{ value: 'natural', label: 'Natural' }
	];
</script>

<!-- A segmented row of radios: one option per segment, the selected one highlighted. It is
     the shape the app used for its tabs, rebuilt here for this control instead of restoring
     the deleted `Tabs.svelte`. -->
<fieldset class="flex flex-col gap-2">
	<h3 class="font-semibold text-xs text-gray-400"><slot /></h3>

	<div class="grid grid-cols-3 gap-1 rounded-md bg-white/10 p-1">
		{#each modes as mode (mode.value)}
			<label
				class="cursor-pointer rounded py-2 text-center text-xs text-gray-400 transition-colors focus-within:ring-2 focus-within:ring-blue-500"
				class:bg-blue-950={setting === mode.value}
				class:text-gray-200={setting === mode.value}
			>
				<input
					type="radio"
					name="bleedMode"
					value={mode.value}
					bind:group={setting}
					class="sr-only"
				/>
				{mode.label}
			</label>
		{/each}
	</div>
</fieldset>
