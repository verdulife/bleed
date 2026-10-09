export type DocSize = {
	width: number;
	height: number;
};

/** A page-box size in millimetres. */
export type BoxSize = { width: number; height: number };

/**
 * The geometry of the document that was produced, in millimetres, as it was read back from
 * the generated PDF: `artwork` is the trim-box size (the document the user asked for),
 * `media` is the media-box size (the page with the crop marks) and `bleed` is the
 * bleed-box size.
 */
export type RenderInfo = {
	artwork: BoxSize;
	media: BoxSize;
	bleed: BoxSize;
	pageCount: number;
};

/**
 * How the bleed area around the artwork is filled, and what the produced page declares.
 *
 * - `none`    no fill, and no bleed declared: the produced BleedBox equals the TrimBox, and the
 *             artwork is both fitted into and clipped to the trim box, so it cannot escape into
 *             the mark margin.
 * - `mirror`  mirrored copies of the artwork are drawn around it.
 * - `natural` the artwork itself is scaled up to cover the bleed area: it is fitted into the
 *             bleed box instead of the trim box, and it always covers, because "contain" would
 *             leave white inside the area this mode exists to fill.
 *
 * The page margin, the declared bleed and the clip box are decided from the mode, the crop marks
 * and `bleedSize` in `src/lib/bleed-mode.ts`.
 */
export type BleedMode = 'none' | 'mirror' | 'natural';

export type BleedSettings = {
	document: DocSize;
	fit: 0 | 1;
	autoRotate: 0 | 1;
	cropMarks: 0 | 1;
	bleedSize: number;
	bleedMode: BleedMode;
};

export type UserFile = {
	fileType: string;
	fileBuffer: ArrayBuffer;
	fileName: string;
	id: number;
};

export type PDFOptions = {
	x: number;
	y: number;
	width: number;
	height: number;
};