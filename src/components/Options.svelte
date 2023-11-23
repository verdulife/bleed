<script>
	import InputFile from '@/components/InputFile.svelte';
	import ButtonGenerate from './ButtonGenerate.svelte';
	import InputSizes from './InputSizes.svelte';
	import InputCropMarksAndBleed from './InputCropMarksAndBleed.svelte';
	import InputMirrorBleed from './InputMirrorBleed.svelte';
	import Logo from './Logo.svelte';
</script>

<main class="flex flex-col gap-2 p-6">
	<Logo></Logo>
	<hr class="border-gray-800 my-6" />
	<InputSizes />
	<InputCropMarksAndBleed />
	<InputMirrorBleed />
	<InputFile />
	<hr class="border-gray-800 my-6" />
	<ButtonGenerate />
</main>
