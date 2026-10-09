<script>
	import { bleedSettings } from '@/lib/stores';

	import OptionBox from '@/components/OptionBox.svelte';
	import InputSizes from '@/components/InputSizes.svelte';
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

	<!-- Independent of the crop marks: marks without a fill and a fill without marks are
	     both valid combinations. `bleedSize` has no control in this panel, so there is
	     nothing to hide in `none` mode either. -->
	<InputBleedMode bind:setting={$bleedSettings.bleedMode}>Bleed fill</InputBleedMode>
</OptionBox>

<span class="sticky bottom-4 mt-6">
	<ButtonGenerate />
</span>
