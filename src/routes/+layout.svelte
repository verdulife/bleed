<script lang="ts">
	import '../app.pcss';
	import DropFile from '@/components/DropFile.svelte';
	import Options from '@/components/Options.svelte';
</script>

<DropFile>
	<main class="flex flex-col-reverse lg:flex-row h-screen">
		<section class="w-full lg:w-1/5 lg:min-w-[300px] h-1/4 lg:h-full overflow-y-scroll scrollbar-none">
			<Options />
		</section>

		<section class="grow h-3/4 lg:h-full p-4">
			<slot />
		</section>
	</main>
</DropFile>
