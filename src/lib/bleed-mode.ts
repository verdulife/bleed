/**
 * The bleed-mode decisions, kept pure and exported so the verification harness can assert
 * them directly (`scripts/verify/bleed-modes.ts`).
 *
 * The user's rules ("bleed behaviour v2", confirmed 2026-10-09) split the old single
 * "does the page need room?" flag (`needsPageMargin`) into independent decisions, one per
 * column of the acceptance table:
 *
 *   - `pageMarginMM` (the media box): the margin is **per side**, from the media edge to
 *     the trim line. Crop marks need `CROPLINE.DISTANCE`; a bleed larger than that distance
 *     grows the page instead of being clamped; with no marks the margin is just the bleed.
 *   - `declaredBleedMM` (the BleedBox): `none` declares no bleed at all, so its BleedBox
 *     equals the TrimBox. A bleed that is not used is not printed into the file.
 *   - `clipExtendsToBleed` (the artwork clip): the trim box in `none`, so the artwork can
 *     not escape into the mark margin; the bleed box in `mirror` and `natural`, so the
 *     fill may reach the bleed line.
 *   - `usesCoverFit` (decision 1): `natural` always covers the bleed area, whatever
 *     `Crop to fit` says, because "contain" would leave white - exactly what `natural`
 *     exists to prevent. `Crop to fit` keeps governing `none` and `mirror`.
 *
 * The box arithmetic itself stays in `computePageBoxes` (`src/lib/page-boxes.ts`): this
 * module decides the margin and the declared bleed it consumes, and which box the artwork
 * is fitted into and clipped to.
 */
import { CROPLINE } from '@/lib/constants';
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
 * The page margin **per side**, from the media edge to the trim line, in millimetres.
 *
 * | Crop marks | Mode      | Margin                 |
 * | ---------- | --------- | ---------------------- |
 * | off        | `none`    | 0 (the page is the art) |
 * | off        | `mirror`  | the bleed              |
 * | off        | `natural` | the bleed              |
 * | on         | `none`    | `max(6 mm, bleed)`     |
 * | on         | `mirror`  | `max(6 mm, bleed)`     |
 * | on         | `natural` | `max(6 mm, bleed)`     |
 *
 * The `max` is decision 2: a bleed larger than the mark distance grows the page, which is
 * what lets a 10 mm bleed be filled at all instead of being clamped to the media box. A
 * negative bleed is clamped to 0, so the margin can never shrink below what the marks need.
 */
export function pageMarginMM(cropMarks: 0 | 1, mode: BleedMode, bleedSizeMM: number): number {
	const bleedMM = Math.max(0, bleedSizeMM);

	if (cropMarks === 1) return Math.max(CROPLINE.DISTANCE, bleedMM);

	return mode === 'none' ? 0 : bleedMM;
}

/**
 * How much bleed the produced file declares, in millimetres, that is the amount the
 * BleedBox extends past the TrimBox on every side.
 *
 * `none` declares 0 (decision 3): the BleedBox equals the TrimBox, so an unused bleed size
 * never reaches the file. Every other mode declares the bleed, clamped at 0 so a negative
 * input degrades to "no bleed" instead of shrinking the box. The crop marks do not appear in
 * the signature because they never change the declared bleed: the margin they need is a
 * separate decision (`pageMarginMM`), and a bleed that is not used is not printed into the
 * file, marks or no marks.
 */
export function declaredBleedMM(mode: BleedMode, bleedSizeMM: number): number {
	return mode === 'none' ? 0 : Math.max(0, bleedSizeMM);
}

/**
 * Whether the artwork clip is the bleed box (`mirror`, `natural`) instead of the trim box.
 * In `none` the artwork is clipped to the trim box so it cannot escape into the mark margin.
 */
export function clipExtendsToBleed(mode: BleedMode): boolean {
	return mode === 'mirror' || mode === 'natural';
}

/**
 * The effective cover decision for the artwork fit: "contain" only survives when the user
 * asked for `fit === 0` **and** the mode is not `natural`. `natural` always covers the
 * bleed area (decision 1) whatever `Crop to fit` says; `none` and `mirror` keep obeying it.
 */
export function usesCoverFit(fit: 0 | 1, mode: BleedMode): boolean {
	return fit === 1 || mode === 'natural';
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
