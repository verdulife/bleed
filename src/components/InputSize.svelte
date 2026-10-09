<script lang="ts">
	import { normalizeBleedSizeMM } from '@/lib/bleed-mode';

	/**
	 * Recovered from `db452d7:src/components/InputSize.svelte`, where it was deleted as an
	 * orphan during the first feature's housekeeping because nothing referenced it. It was
	 * almost certainly this not-yet-wired input: it already carried the `bleedSize` id, the
	 * millimetre suffix and the `setting` prop every other settings control uses.
	 *
	 * Adaptations: the value is normalised (`normalizeBleedSizeMM`) instead of bound raw, the
	 * step follows the normaliser's precision (a tenth of a millimetre) and the control can be
	 * disabled when the value is not used.
	 */
	export let setting: number;
	/** `true` while the value is unused (`bleedMode === 'none'`, T1 decision 3). */
	export let disabled = false;

	/**
	 * Commit on `change` (blur or Enter) instead of on every keystroke: every change must pass
	 * through `normalizeBleedSizeMM`, and doing that on each `input` would rewrite the field
	 * while the user types ("3." would round back to "3", so a decimal could never be entered).
	 */
	function commit(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		// A cleared field is `NaN`; the normaliser degrades it to 0 instead of letting it
		// reach the box math.
		setting = normalizeBleedSizeMM(input.valueAsNumber);
	}
</script>

<!-- The recovered layout: label on the left, the value and its `mm` suffix on the right, the
     same treatment as `InputSizes.svelte`. The fieldset dims with `disabled:opacity-50` while
     disabled instead of disappearing, so the control stays visible and findable in `none`.
     `max` is the recovered control's ceiling: kept as a UI hint only, since the normaliser has
     no upper clamp (a bleed larger than the mark distance is a supported shape). -->
<fieldset class="flex justify-between items-center gap-2 w-full disabled:opacity-50" {disabled}>
	<h3 class="font-semibold text-xs text-gray-400 whitespace-nowrap"><slot /></h3>

	<div class="w-1/3 flex bg-white/10 rounded-md">
		<input
			type="number"
			id="bleedSize"
			min={0}
			max={10}
			step="0.1"
			value={setting}
			on:change={commit}
			{disabled}
			class="p-3 w-full bg-transparent text-sm disabled:cursor-not-allowed"
		/>
		<span class="p-3 bg-black/30 text-xs text-gray-400 grid place-content-center">mm</span>
	</div>
</fieldset>
