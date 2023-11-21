<script lang="ts">
	import { generatePDF } from "@/lib/generate-pdf";

  let asyncData = $derived(generatePDF());
</script>

{#await asyncData then data}
	<object {data} type="application/pdf" title="Preview PDF" class="bg-slate-500 w-full h-full">
		<p>Ha ocurrido un error generando el PDF 😢</p>
	</object>
{/await}
