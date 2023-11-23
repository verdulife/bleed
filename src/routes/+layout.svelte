<script lang="ts">
	import "../app.pcss";
	import Options from "@/components/Options.svelte";
</script>

<main class="flex flex-col-reverse lg:flex-row h-screen">
	<section class="w-full lg:w-1/5 lg:min-w-[300px] h-1/4 lg:h-full">
		<Options />
	</section>

	<section class="grow h-3/4 lg:h-full p-4 pl-0">
		<slot />
	</section>
</main>
