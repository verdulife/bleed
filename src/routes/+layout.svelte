<script lang="ts">
	import '@/app.pcss';
	import DropFile from '@/components/DropFile.svelte';
	import Options from '@/components/Options.svelte';
	import RenderInfoPanel from '@/components/RenderInfoPanel.svelte';
</script>

<DropFile>
	<!-- Column layout: the options column and the preview share the remaining height, and the
	     output bar below them takes its natural height (and no height at all while it renders
	     nothing). `flex-1 min-h-0` on the top row is what keeps the options column scrolling
	     instead of stretching: without `min-h-0` a flex item refuses to shrink below its
	     content, and the two scrolling areas would push the bar off the viewport. -->
	<main class="flex h-dvh flex-col">
		<div class="flex min-h-0 flex-1">
			<section class="h-full w-80 overflow-y-scroll py-6 pl-6 scrollbar-none">
				<Options />
			</section>

			<section class="col-auto h-full flex-1 p-6">
				<slot />
			</section>
		</div>

		<RenderInfoPanel />
	</main>
</DropFile>
