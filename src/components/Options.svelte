<script>
	import { userSettings } from '@/lib/stores';

	import OptionBox from '@/components/OptionBox.svelte';
	import InputSizes from '@/components/InputSizes.svelte';
	import InputCheck from '@/components/InputCheck.svelte';
	import InputFile from '@/components/InputFile.svelte';
	import ButtonGenerate from '@/components/ButtonGenerate.svelte';
	import Logo from '@/components/Logo.svelte';

	$: if ($userSettings.cropMarksAndBleed === 0) $userSettings.mirrorBleed = 0;
</script>

<main class="flex flex-col gap-2 p-6">
	<span class="mb-6">
		<Logo></Logo>
	</span>

	<OptionBox>
		<InputSizes bind:setting={$userSettings.document}>Document size</InputSizes>
		<InputCheck bind:setting={$userSettings.fit}>Crop to fit</InputCheck>
		<InputCheck bind:setting={$userSettings.autoRotate}>Autorotate</InputCheck>
	</OptionBox>

	<OptionBox>
		<InputCheck bind:setting={$userSettings.cropMarksAndBleed}>Add crop marks</InputCheck>
		{#if $userSettings.cropMarksAndBleed}
			<InputCheck bind:setting={$userSettings.mirrorBleed}>Use mirror bleed</InputCheck>
		{/if}
	</OptionBox>

	<!-- <OptionBox>
		<InputCheck bind:setting={$userSettings.repeat}>Repeat document</InputCheck>
		{#if $userSettings.repeat}
			<InputSizes bind:setting={$userSettings.artboard}>Artboard size</InputSizes>
			<InputSize bind:setting={$userSettings.repeatX}>Repeat horizontaly</InputSize>
			<InputSize bind:setting={$userSettings.repeatY}>Repeat verticaly</InputSize>
			<InputSize bind:setting={$userSettings.gapX}>Horizontal gap</InputSize>
			<InputSize bind:setting={$userSettings.gapY}>Vetical gap</InputSize>
		{/if}
	</OptionBox> -->

	<OptionBox>
		<InputFile />
	</OptionBox>

	<span class="sticky bottom-4 mt-6">
		<ButtonGenerate />
	</span>
</main>
