<script lang="ts">
	import "../app.pcss";
	import Options from "@/components/Options.svelte";
</script>

<main class="grid grid-cols-4 grid-rows-1 h-screen">
	<section class="col-span-3 row-span-1">
		<slot />
	</section>

	<section class="col-span-1 row-span-1">
		<Options />
	</section>
</main>
