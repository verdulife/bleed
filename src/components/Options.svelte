<script lang="ts">
	import { bleedSettings } from '@/lib/stores';

	import Logo from '@/components/Logo.svelte';
	import OptionBox from '@/components/OptionBox.svelte';
	import Tabs from '@/components/Tabs.svelte';
	import OptionsBleed from '@/components/OptionsBleed.svelte';
	import OptionsRepeat from '@/components/OptionsRepeat.svelte';

	$: if ($bleedSettings.cropMarksAndBleed === 0) $bleedSettings.mirrorBleed = 0;
	let currentTab: 'bleed' | 'repeat' = 'bleed';
</script>

<main class="flex w-full flex-col gap-2">
	<span class="mb-6">
		<Logo></Logo>
	</span>

	<OptionBox>
		<Tabs bind:tab={currentTab} />
	</OptionBox>

	{#if currentTab === 'bleed'}
		<OptionsBleed />
	{:else if currentTab === 'repeat'}
		<OptionsRepeat />
	{/if}
</main>
