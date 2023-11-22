<script>
	import { generatePDF } from '@/lib/generate-pdf';
</script>

<button
	on:click={generatePDF}
	class="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
>
	Process PDF
</button>
