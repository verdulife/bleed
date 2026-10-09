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

	/** The difference between the two sizes, per axis, as a signed value. */
	function formatGrowth(media: BoxSize, artwork: BoxSize): string {
		return `+${formatMM(media.width - artwork.width)} × +${formatMM(media.height - artwork.height)} mm`;
	}
</script>

<!-- Informational, not an alert: no `role="alert"`, and nothing to dismiss or edit. The
     numbers are the ones read back from the generated PDF, so the panel is what tells the
     user which size the app decided on for an axis derived from the artwork. -->
{#if $renderInfo}
	<div
		class="flex w-full flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400"
	>
		<p class="font-semibold text-slate-300">Output sizes</p>

		<dl class="flex flex-col gap-1">
			<div class="flex items-baseline justify-between gap-3">
				<dt>Without crop marks</dt>
				<dd class="font-semibold text-slate-200">{formatSize($renderInfo.artwork)}</dd>
			</div>
			<div class="flex items-baseline justify-between gap-3">
				<dt>With crop marks</dt>
				<dd class="font-semibold text-slate-200">{formatSize($renderInfo.media)}</dd>
			</div>
			<div class="flex items-baseline justify-between gap-3">
				<dt>Added by crop marks</dt>
				<dd>{formatGrowth($renderInfo.media, $renderInfo.artwork)}</dd>
			</div>
			<div class="flex items-baseline justify-between gap-3">
				<dt>Bleed area</dt>
				<dd>{formatSize($renderInfo.bleed)}</dd>
			</div>
			<div class="flex items-baseline justify-between gap-3">
				<dt>Pages</dt>
				<dd>{$renderInfo.pageCount}</dd>
			</div>
		</dl>

		<p class="text-[10px] leading-tight text-slate-500">Read back from the generated PDF.</p>
	</div>
{/if}
