<script lang="ts">
	import "../app.pcss";
	import Options from "@/components/Options.svelte";
</script>

<main class="grid grid-cols-5 grid-rows-1 h-screen">
	<section class="col-span-1 row-span-1">
		<Options />
	</section>

	<section class="col-span-4 row-span-1">
		<slot />
	</section>
</main>
