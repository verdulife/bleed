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

	/** The value every field shows while no document has been rendered yet. */
	const placeholder = '--';

	$: info = $renderInfo;
	$: artwork = info ? formatSize(info.artwork) : placeholder;
	$: media = info ? formatSize(info.media) : placeholder;
	$: bleedAmount = info ? `${formatMM(info.bleedAmountMM)} mm` : placeholder;
	$: pages = info ? String(info.pageCount) : placeholder;
</script>

<!-- The output bar: a full-width row across the bottom of the app, its four values laid out
     inline (one horizontal row that wraps on narrow screens). Informational, not an alert:
     no `role="alert"`, nothing to dismiss or edit. It is always present so the layout above it
     never moves: while no run has produced a document yet, every field shows `--` and the row
     keeps the same labels, padding and height as when it is filled. The numbers are the ones
     read back from the generated PDF, so the bar is what tells the user which size the app
     decided on for an axis derived from the artwork aspect ratio, and how much bleed the file
     actually declares. -->
<div
	class="flex w-full flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400"
>
	<dl class="flex flex-wrap items-baseline gap-x-6 gap-y-1">
		<div class="flex items-baseline gap-2">
			<dt>Without crop marks</dt>
			<dd class="font-semibold text-slate-200">{artwork}</dd>
		</div>
		<div class="flex items-baseline gap-2">
			<dt>With crop marks</dt>
			<dd class="font-semibold text-slate-200">{media}</dd>
		</div>
		<!-- The bleed amount as the file declares it, not the bleed-box size: the box grows
		     with the artwork, the amount is the prepress quantity the user configured. -->
		<div class="flex items-baseline gap-2">
			<dt>Bleed size</dt>
			<dd class="font-semibold text-slate-200">{bleedAmount}</dd>
		</div>
		<div class="flex items-baseline gap-2">
			<dt>Pages</dt>
			<dd class="font-semibold text-slate-200">{pages}</dd>
		</div>
	</dl>
</div>
