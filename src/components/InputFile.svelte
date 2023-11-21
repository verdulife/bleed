<script lang="ts">
	import { userFiles } from '@/lib/stores';
	import { getFileURL, inputFileAsync } from '@/lib/utils';

  async function addFiles() {
    const files = await inputFileAsync();

    Array.from(files).forEach(async file => {
      const fileBuffer = await file.arrayBuffer();
      
      $userFiles.push(fileBuffer);
      $userFiles = $userFiles;
    })
  };
</script>

<main>
	<button on:click={addFiles} class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700">
		Añadir
	</button>
</main>
