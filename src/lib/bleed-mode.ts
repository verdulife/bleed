/**
 * The bleed-mode decisions, kept pure and exported so the verification harness can assert
 * them directly (`scripts/verify/bleed-modes.ts`): the mode only decides which box the
 * artwork is fitted into, whether the mirrored copies are drawn, and whether the page needs
 * the margin that holds the crop marks and the bleed area.
 *
 * The produced geometry itself does not depend on the mode: `computePageBoxes` stays the
 * single source of truth for the boxes, and the clip mask (`openCropMask`) already bounds
 * the bleed area, so only the artwork target box and the fill change here.
 */
import type { BleedMode } from '@/lib/types';
import type { PageBox } from '@/lib/page-boxes';

/** Which of the page's boxes the artwork is fitted into. */
export type ArtworkTargetBox = 'trim' | 'bleed';

/**
 * `none` and `mirror` place the artwork on the trim box: the trim area stays the artwork,
 * and `mirror` fills the bleed around it. `natural` fits the artwork into the bleed box so
 * the artwork itself covers the bleed area.
 */
export function artworkTargetBoxForBleedMode(mode: BleedMode): ArtworkTargetBox {
	return mode === 'natural' ? 'bleed' : 'trim';
}

/** Only `mirror` draws mirrored copies of the artwork around it; the other modes draw none. */
export function drawsMirrorBleed(mode: BleedMode): boolean {
	return mode === 'mirror';
}

/**
 * Whether the page needs the margin that `CROPLINE.DISTANCE` adds on every side.
 *
 * The margin exists for the crop marks **and** for the bleed area. Either concern on its
 * own is enough, which is exactly what the previous single `cropMarksAndBleed` flag could
 * not express: "crop marks without a bleed fill" and "a bleed fill without crop marks" both
 * need the margin, and only "neither" does not.
 */
export function needsPageMargin(cropMarks: 0 | 1, mode: BleedMode): boolean {
	return cropMarks === 1 || mode !== 'none';
}

/** The page boxes an artwork target box can resolve to (structurally satisfied by `PDFPage`). */
type PageBoxSource = {
	getTrimBox(): PageBox;
	getBleedBox(): PageBox;
};

/**
 * Resolves the artwork target box against the page. The page carries its final boxes by the
 * time this is called (`applyPageGeometry` runs first), so this is a read in points, ready
 * for `setEmbed`.
 */
export function resolveArtworkTargetBox(page: PageBoxSource, mode: BleedMode): PageBox {
	return artworkTargetBoxForBleedMode(mode) === 'bleed' ? page.getBleedBox() : page.getTrimBox();
}
