<script lang="ts">
  import { onMount } from 'svelte';

  let files: File[] = [];

  const handleFileChange = (event: { target: { files: FileList } }) => {
    // Actualiza la lista de archivos cuando el usuario selecciona archivos mediante clic
    files = Array.from(event.target.files || []);
  };

  const handleDrop = (event: { preventDefault: () => void; dataTransfer: { files: FileList } }) => {
    event.preventDefault();

    // Actualiza la lista de archivos cuando el usuario arrastra y suelta archivos
    files = Array.from(event.dataTransfer.files || []);
  };

  const handleDragOver = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  // Maneja la carga de archivos al componente padre
  const submitFiles = () => {
    // Puedes pasar la lista de archivos al componente padre mediante una función o evento
    // Por ejemplo, podrías emitir un evento personalizado para notificar al padre sobre los archivos seleccionados
    // o podrías llamar a una función proporcionada por el padre para manejar los archivos.
  };

  // Limpia la lista de archivos cuando el componente es destruido
  onMount(() => {
    return () => {
      files = [];
    };
  });
</script>

<main on:drop={handleDrop} on:dragover={handleDragOver}>
	<h2 class="text-2xl font-bold mb-4">Añadir Archivos</h2>

	<input type="file" multiple on:change={handleFileChange} class="mb-4" />

	<div
		class="border-dashed border-2 border-gray-300 p-4 mb-4"
		on:drop={handleDrop}
		on:dragover={handleDragOver}
	>
		<p class="text-gray-400 text-sm">Arrastra y suelta archivos aquí</p>
	</div>

	<button on:click={submitFiles} class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700">
		Enviar Archivos
	</button>
</main>
