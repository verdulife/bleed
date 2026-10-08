<script>
	import { generatePDF } from '@/lib/generate-pdf';

	function generate() {
		generatePDF();
	}
</script>

<button
	on:click={generate}
	class="w-full rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-700"
>
	Process PDF
</button>
