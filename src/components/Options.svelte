<script>
	import InputFile from '@/components/InputFile.svelte';
	import ButtonGenerate from './ButtonGenerate.svelte';
	import InputSizes from './InputSizes.svelte';
	import InputCropMarksAndBleed from './InputCropMarksAndBleed.svelte';
	import Logo from './Logo.svelte';
</script>

<main class="flex flex-col gap-2 p-6">
	<span class="mb-6">
		<Logo></Logo>
	</span>

	<InputSizes />
	<InputCropMarksAndBleed />
	<InputFile />

	<span class="mt-6">
		<ButtonGenerate />
	</span>
</main>
