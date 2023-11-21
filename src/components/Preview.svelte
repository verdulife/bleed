<script lang="ts">
	import { generatePDF } from "@/lib/generate-pdf";

  let asyncData = generatePDF();
</script>

{#await asyncData then data}
	<object {data} type="application/pdf" title="Preview PDF" class="bg-slate-500 w-full h-full">
		<p>
			El navegador no es compatible con la visualización de PDF.
			<br />
			Puedes descargarlo <a href={data}>aquí</a>.
		</p>
	</object>
{/await}
