/**
 * The single source of truth for the prepress page-box geometry, in millimetres.
 *
 * The margin is **per side**, from the media edge to the trim line, and it is the caller's
 * decision (`pageMarginMM` in `src/lib/bleed-mode.ts`): it is `CROPLINE.DISTANCE` when the
 * crop marks need room, the bleed when the page only grows for a bleed, and the larger of
 * the two when both apply. `addCropMarks` (`src/lib/crop-marks.ts`) anchors its marks to
 * the trim line **read from this geometry**, so whatever the caller decides, the marks land
 * on the artwork edge.
 *
 * It is deliberately pure: no store access and no pdf-lib import, so the geometry can be
 * checked directly by `scripts/verify/page-boxes.ts`.
 */
export type PageBox = { x: number; y: number; width: number; height: number };
export type PageBoxes = { media: PageBox; bleed: PageBox; trim: PageBox };

/**
 * The three boxes of one output page, all in millimetres.
 *
 * - `media` = the artwork plus `marginMM` on every side (room for the crop marks and/or for
 *   the bleed area).
 * - `trim`  = the media box inset by `marginMM`, which is exactly the artwork area.
 * - `bleed` = the media box inset by `max(0, marginMM - bleedMM)`, the "declared" bleed:
 *   the amount the BleedBox extends past the TrimBox. The caller passes the declared bleed,
 *   which is 0 in `none` mode (`declaredBleedMM`), so the BleedBox equals the TrimBox there.
 *
 * Two identities hold and are asserted in the harness: with `marginMM === bleedMM` the
 * bleed box coincides with the page (the inset is 0), and with `bleedMM === 0` it coincides
 * with the trim box. A bleed larger than the margin and a negative bleed both degrade to
 * "no extra room" instead of producing an inverted box.
 */
export function computePageBoxes(
	artworkWidthMM: number,
	artworkHeightMM: number,
	marginMM: number,
	bleedMM: number
): PageBoxes {
	// A negative margin reaches this function only through a caller bug; clamping it keeps
	// the identity `media = art + 2 * margin` true and never lets the boxes invert.
	const margin = Math.max(0, marginMM);
	const media: PageBox = {
		x: 0,
		y: 0,
		width: artworkWidthMM + 2 * margin,
		height: artworkHeightMM + 2 * margin
	};

	// The bleed inset shrinks as `bleedMM` grows. Clamping it at 0 (and clamping a negative
	// bleed size at 0 first) means an oversized or negative bleed degrades to the media box
	// instead of producing a box with a negative width or height.
	const bleedInsetMM = Math.max(0, margin - Math.max(0, bleedMM));

	return {
		media,
		bleed: insetBox(media, bleedInsetMM),
		trim: insetBox(media, margin)
	};
}

/** A box inset by `insetMM` on every side; `insetMM` is assumed to be non-negative. */
function insetBox(box: PageBox, insetMM: number): PageBox {
	return {
		x: box.x + insetMM,
		y: box.y + insetMM,
		width: box.width - 2 * insetMM,
		height: box.height - 2 * insetMM
	};
}
