<script>
	import { repeatSettings } from '@/lib/stores';

	import OptionBox from '@/components/OptionBox.svelte';
	import InputFile from '@/components/InputFile.svelte';
	import InputSizes from '@/components/InputSizes.svelte';
	import ButtonGenerate from '@/components/ButtonGenerate.svelte';
	import SelectPresets from '@/components/SelectPresets.svelte';
	import InputAxis from '@/components/InputAxis.svelte';
</script>

<OptionBox>
	<InputFile onlyPdf />
</OptionBox>

<OptionBox>
	<InputSizes bind:setting={$repeatSettings.artboard}>Artboard size</InputSizes>
	<SelectPresets bind:setting={$repeatSettings.artboard}>Presets</SelectPresets>
	<InputSizes bind:setting={$repeatSettings.embed}>File size</InputSizes>
	<SelectPresets bind:setting={$repeatSettings.embed}>Presets</SelectPresets>
</OptionBox>

<OptionBox>
	<InputAxis bind:x={$repeatSettings.repeatX} bind:y={$repeatSettings.repeatY}>Repeat</InputAxis>
	<InputAxis bind:x={$repeatSettings.gapX} bind:y={$repeatSettings.gapY}>Gap (mm)</InputAxis>
</OptionBox>

<span class="sticky bottom-4 mt-6">
	<ButtonGenerate isRepeat />
</span>
