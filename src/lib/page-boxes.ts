/**
 * The single source of truth for the prepress page-box geometry, in millimetres.
 *
 * `addCropMarks` (`src/lib/crop-marks.ts`) draws every mark `CROPLINE.DISTANCE` away from
 * the media edge, so the trim line it marks is exactly `CROPLINE.DISTANCE` from that edge.
 * This module encodes the same convention as the output page boxes, which keeps the trim
 * box on the artwork edge whatever the bleed size is.
 *
 * It is deliberately pure: no store access and no pdf-lib import, so the geometry can be
 * checked directly by `scripts/verify/page-boxes.ts`.
 */
import { CROPLINE } from '@/lib/constants';

export type PageBox = { x: number; y: number; width: number; height: number };
export type PageBoxes = { media: PageBox; bleed: PageBox; trim: PageBox };

/**
 * The three boxes of one output page, all in millimetres.
 *
 * - `media` = the artwork plus `CROPLINE.DISTANCE` on every side (room for the crop marks).
 * - `trim`  = the media box inset by `CROPLINE.DISTANCE`, which is exactly the artwork
 *   area, so the crop marks drawn at that distance land on the artwork edge.
 * - `bleed` = the media box inset by `CROPLINE.DISTANCE - bleedSizeMM`: the bleed extends
 *   `bleedSizeMM` beyond the trim line. The inset is clamped so it can never invert, and a
 *   negative `bleedSizeMM` is treated as 0.
 *
 * With crop marks off the page is just the artwork and all three boxes are identical,
 * which is the behaviour the app already had and must keep.
 */
export function computePageBoxes(
	artworkWidthMM: number,
	artworkHeightMM: number,
	bleedSizeMM: number,
	withCropMarks: boolean
): PageBoxes {
	if (!withCropMarks) {
		const artwork: PageBox = { x: 0, y: 0, width: artworkWidthMM, height: artworkHeightMM };
		return { media: { ...artwork }, bleed: { ...artwork }, trim: { ...artwork } };
	}

	const media: PageBox = {
		x: 0,
		y: 0,
		width: artworkWidthMM + 2 * CROPLINE.DISTANCE,
		height: artworkHeightMM + 2 * CROPLINE.DISTANCE
	};

	// The bleed inset shrinks as `bleedSizeMM` grows. Clamping it at 0 (and clamping a
	// negative bleed size at 0 first) means an oversized or negative bleed degrades to the
	// media box instead of producing a box with a negative width or height.
	const bleedInsetMM = Math.max(0, CROPLINE.DISTANCE - Math.max(0, bleedSizeMM));

	return {
		media,
		bleed: insetBox(media, bleedInsetMM),
		trim: insetBox(media, CROPLINE.DISTANCE)
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
