<script>
	import { bleedSettings } from '@/lib/stores';

	import OptionBox from '@/components/OptionBox.svelte';
	import InputSizes from '@/components/InputSizes.svelte';
	import InputSize from '@/components/InputSize.svelte';
	import InputCheck from '@/components/InputCheck.svelte';
	import InputBleedMode from '@/components/InputBleedMode.svelte';
	import InputFile from '@/components/InputFile.svelte';
	import GenerationNotice from '@/components/GenerationNotice.svelte';
	import RenderInfoPanel from '@/components/RenderInfoPanel.svelte';
	import SelectPresets from '@/components/SelectPresets.svelte';
	import ButtonGenerate from './ButtonGenerate.svelte';
</script>

<OptionBox>
	<InputFile />
</OptionBox>

<GenerationNotice />

<RenderInfoPanel />

<OptionBox>
	<InputSizes bind:setting={$bleedSettings.document}>Document size</InputSizes>
	<SelectPresets bind:setting={$bleedSettings.document}>Presets</SelectPresets>
	<InputCheck bind:setting={$bleedSettings.fit}>Crop to fit</InputCheck>
	<InputCheck bind:setting={$bleedSettings.autoRotate}>Autorotate</InputCheck>
</OptionBox>

<OptionBox>
	<InputCheck bind:setting={$bleedSettings.cropMarks}>Add crop marks</InputCheck>

	<!-- The bleed amount, declared in millimetres. `none` declares no bleed at all (T1 decision
	     3), so in that mode the number never reaches the file: the control is disabled and
	     dimmed rather than hidden, because the user asked for it and should see where it lives. -->
	<InputSize
		bind:setting={$bleedSettings.bleedSize}
		disabled={$bleedSettings.bleedMode === 'none'}>Bleed size</InputSize>

	<!-- Independent of the crop marks: marks without a fill and a fill without marks are
	     both valid combinations. -->
	<InputBleedMode bind:setting={$bleedSettings.bleedMode}>Bleed fill</InputBleedMode>
</OptionBox>

<span class="sticky bottom-4 mt-6">
	<ButtonGenerate />
</span>
