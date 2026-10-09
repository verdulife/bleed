<script lang="ts">
	import { renderInfo } from '@/lib/stores';
	import type { BoxSize } from '@/lib/types';

	/** A tenth of a millimetre is as fine as a prepress panel needs to be. */
	function formatMM(value: number): string {
		return (Math.round(value * 10) / 10).toFixed(1);
	}

	function formatSize(size: BoxSize): string {
		return `${formatMM(size.width)} × ${formatMM(size.height)} mm`;
	}
</script>

<!-- The output bar: a full-width row across the bottom of the app, its four values laid out
     inline (one horizontal row that wraps on narrow screens). Informational, not an alert:
     no `role="alert"`, nothing to dismiss or edit, and it renders nothing until a run has
     produced a document. The numbers are the ones read back from the generated PDF, so the
     bar is what tells the user which size the app decided on for an axis derived from the
     artwork aspect ratio, and how much bleed the file actually declares. -->
{#if $renderInfo}
	<div
		class="flex w-full flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400"
	>
		<dl class="flex flex-wrap items-baseline gap-x-6 gap-y-1">
			<div class="flex items-baseline gap-2">
				<dt>Without crop marks</dt>
				<dd class="font-semibold text-slate-200">{formatSize($renderInfo.artwork)}</dd>
			</div>
			<div class="flex items-baseline gap-2">
				<dt>With crop marks</dt>
				<dd class="font-semibold text-slate-200">{formatSize($renderInfo.media)}</dd>
			</div>
			<!-- The bleed amount as the file declares it, not the bleed-box size: the box grows
			     with the artwork, the amount is the prepress quantity the user configured. -->
			<div class="flex items-baseline gap-2">
				<dt>Bleed size</dt>
				<dd class="font-semibold text-slate-200">{formatMM($renderInfo.bleedAmountMM)} mm</dd>
			</div>
			<div class="flex items-baseline gap-2">
				<dt>Pages</dt>
				<dd class="font-semibold text-slate-200">{$renderInfo.pageCount}</dd>
			</div>
		</dl>

		<p class="ml-auto text-[10px] leading-tight text-slate-500">Read back from the generated PDF.</p>
	</div>
{/if}
