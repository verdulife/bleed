<script lang="ts">
	import '@/app.pcss';
	import DropFile from '@/components/DropFile.svelte';
	import Options from '@/components/Options.svelte';
</script>

<DropFile>
	<main class="flex h-dvh">
		<section class="h-full w-80 overflow-y-scroll py-6 pl-6 scrollbar-none">
			<Options />
		</section>

		<section class="col-auto h-full flex-1 p-6">
			<slot />
		</section>
	</main>
</DropFile>
