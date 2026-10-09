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
 * How the bleed area around the artwork is filled. It never decides whether a bleed box
 * exists: `bleedSize` always defines the produced BleedBox, which is geometry the printer
 * reads, so `none` means "do not fill the bleed area", not "declare no bleed".
 *
 * - `none`    no fill; the artwork is fitted into the trim box.
 * - `mirror`  mirrored copies of the artwork are drawn around it (today's fill).
 * - `natural` the artwork itself is scaled up to cover the bleed area: it is fitted into
 *             the bleed box instead of the trim box.
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