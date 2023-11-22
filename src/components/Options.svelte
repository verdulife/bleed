<script>
	import InputFile from '@/components/InputFile.svelte';
	import ButtonGenerate from './ButtonGenerate.svelte';
	import InputSizes from './InputSizes.svelte';
	import InputCropMarks from './InputCropMarks.svelte';
</script>

<main class="flex flex-col gap-8 p-8 overflow-hidden">
	<InputFile />
	<hr class="border-gray-800" />
	<InputSizes />
	<hr class="border-gray-800" />
	<InputCropMarks />
	<hr class="border-gray-800" />
	<ButtonGenerate />
</main>
