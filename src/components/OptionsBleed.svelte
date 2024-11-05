<script>
	import { bleedSettings } from '@/lib/stores';

	import OptionBox from '@/components/OptionBox.svelte';
	import InputSizes from '@/components/InputSizes.svelte';
	import InputCheck from '@/components/InputCheck.svelte';
	import InputFile from '@/components/InputFile.svelte';
	import SelectPresets from '@/components/SelectPresets.svelte';
	import ButtonGenerate from './ButtonGenerate.svelte';
</script>

<OptionBox>
	<InputFile />
</OptionBox>

<OptionBox>
	<InputSizes bind:setting={$bleedSettings.document}>Document size</InputSizes>
	<SelectPresets bind:setting={$bleedSettings.document}>Presets</SelectPresets>
	<InputCheck bind:setting={$bleedSettings.fit}>Crop to fit</InputCheck>
	<InputCheck bind:setting={$bleedSettings.autoRotate}>Autorotate</InputCheck>
</OptionBox>

<OptionBox>
	<InputCheck bind:setting={$bleedSettings.cropMarksAndBleed}>Add crop marks</InputCheck>
	{#if $bleedSettings.cropMarksAndBleed}
		<InputCheck bind:setting={$bleedSettings.mirrorBleed}>Use mirror bleed</InputCheck>
	{/if}
</OptionBox>

<span class="sticky bottom-4 mt-6">
	<ButtonGenerate />
</span>
