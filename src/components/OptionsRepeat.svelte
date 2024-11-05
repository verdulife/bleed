<script>
	import { repeatSettings } from '@/lib/stores';

	import OptionBox from '@/components/OptionBox.svelte';
	import InputFile from '@/components/InputFile.svelte';
	import InputSizes from '@/components/InputSizes.svelte';
	import InputSize from '@/components/InputSize.svelte';
	import ButtonGenerate from './ButtonGenerate.svelte';
	import SelectPresets from './SelectPresets.svelte';
</script>

<OptionBox>
	<InputFile onlyPdf />
</OptionBox>

<OptionBox>
	<InputSizes bind:setting={$repeatSettings.artboard}>Artboard size</InputSizes>
	<SelectPresets bind:setting={$repeatSettings.artboard}>Presets</SelectPresets>
</OptionBox>

<OptionBox>
	<InputSize bind:setting={$repeatSettings.repeatX}>Repeat horizontaly</InputSize>
	<InputSize bind:setting={$repeatSettings.repeatY}>Repeat verticaly</InputSize>
	<InputSize bind:setting={$repeatSettings.gapX}>Horizontal gap</InputSize>
	<InputSize bind:setting={$repeatSettings.gapY}>Vetical gap</InputSize>
</OptionBox>

<span class="sticky bottom-4 mt-6">
	<ButtonGenerate isRepeat />
</span>
