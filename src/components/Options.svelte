<script lang="ts">
	import { bleedSettings } from '@/lib/stores';

	import Logo from '@/components/Logo.svelte';
	import OptionsBleed from '@/components/OptionsBleed.svelte';

	$: if ($bleedSettings.cropMarksAndBleed === 0) $bleedSettings.mirrorBleed = 0;
</script>

<main class="flex w-full flex-col gap-2">
	<span class="mb-6">
		<Logo></Logo>
	</span>

	<OptionsBleed />
</main>
