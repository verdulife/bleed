<script lang="ts">
	import { previewBlobUri } from "@/lib/stores";
</script>

<object data={$previewBlobUri} type="application/pdf" title="Preview PDF" class="bg-slate-500 w-full h-full">
	<p>Ha ocurrido un error generando el PDF 😢</p>
</object>
