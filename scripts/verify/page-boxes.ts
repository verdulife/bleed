/**
 * Verification cases for the pure page-box geometry (defect D3, then the v2 geometry).
 *
 * `computePageBoxes` is the single source of truth for the three output boxes. Its
 * signature is now `(artworkWidthMM, artworkHeightMM, marginMM, bleedMM)`: the **margin**
 * per side is the caller's decision (`pageMarginMM` in `src/lib/bleed-mode.ts`) and the
 * **bleed** is the amount the file declares (`declaredBleedMM`), which is 0 in `none` mode.
 * The function no longer owns the `CROPLINE.DISTANCE` inset and no longer takes the old
 * `withPageMargin` boolean.
 *
 * The first seven cases are pure and drive `computePageBoxes` directly; every expected value
 * is derived from `CROPLINE.DISTANCE` and the bleed size, so there is no magic millimetre in
 * the expectations. The last case is the acceptance check the pure function cannot give on
 * its own: it runs the real `fileHandler[FILE_TYPE.PDF]` and reads the produced PDF back to
 * assert the boxes that were actually serialized.
 *
 * D3 ("the prepress boxes are only correct when `bleedSize === 3`") is the reason the pure
 * cases exist at all: `addCropMarks` used to draw the trim line `CROPLINE.DISTANCE` from the
 * media edge while the box math used `CROPLINE.SIZE - CROPLINE.OVERLAY`, so the boxes were
 * only exact at the historical fixed point. The trim box must follow the mark distance for
 * every bleed size.
 */
import { CROPLINE, FILE_TYPE, toMM } from '@/lib/constants';
import { PDFDocument } from 'pdf-lib';
import type { VerifyCase } from './harness';
import { assert, assertEqual, buildPaintedPdfFixture } from './harness';
import { computePageBoxes } from '@/lib/page-boxes';
import type { PageBox } from '@/lib/page-boxes';

// --- inputs -------------------------------------------------------------------

/** The document the defect was measured on (210 x 297 mm, crop marks on). */
const ARTWORK_WIDTH_MM = 210;
const ARTWORK_HEIGHT_MM = 297;

/**
 * The margin a document with crop marks uses while the bleed is smaller than the mark
 * distance: the trim line sits `CROPLINE.DISTANCE` from the media edge, which is what makes
 * the marks land on the artwork.
 */
const CROP_MARK_MARGIN_MM = CROPLINE.DISTANCE;

/**
 * A small fixture bleed below the mark margin. It used to be named `DEFAULT_BLEED_SIZE_MM`
 * and mirrored the store default, which was 2 mm when this case was written; T2 moved the
 * store default to 3 mm, so the constant is now a purely local fixture value and every use
 * passes it explicitly. The case must not follow the store default: its geometry is the
 * point, not the shipped number.
 */
const FIXTURE_BLEED_SIZE_MM = 2;

/**
 * The historical fixed point: the old code used `CROPLINE.SIZE - CROPLINE.OVERLAY` as the
 * bleed-box inset and `bleedSize + that` as the trim-box inset, so the boxes were only
 * exact when the bleed size happened to equal that crop-mark size.
 */
const HISTORICAL_BLEED_SIZE_MM = CROPLINE.SIZE - CROPLINE.OVERLAY;

/** Deliberately larger than the margin, to exercise the defensive clamp. */
const OVERSIZED_BLEED_SIZE_MM = 15;

/** Below zero: must be treated as no bleed at all, never as an inverted box. */
const NEGATIVE_BLEED_SIZE_MM = -FIXTURE_BLEED_SIZE_MM;

/** Pure millimetre arithmetic, so only float noise is tolerated. */
const MM_EPSILON = 1e-9;

/**
 * After the point conversion and PDF serialization the values come back with a small
 * rounding error, so the produced-document check compares with a looser tolerance.
 */
const PRODUCED_MM_EPSILON = 1e-3;

// --- expected boxes (all derived from CROPLINE.DISTANCE) -----------------------

function describeBox(box: PageBox) {
	return `{ x: ${box.x}, y: ${box.y}, width: ${box.width}, height: ${box.height} }`;
}

/** The artwork alone, at the origin: the box the trim must land on. */
function expectedArtworkBox(): PageBox {
	return { x: 0, y: 0, width: ARTWORK_WIDTH_MM, height: ARTWORK_HEIGHT_MM };
}

/** The media box: the artwork plus the margin on every side. */
function expectedMediaBox(marginMM = CROP_MARK_MARGIN_MM): PageBox {
	return {
		x: 0,
		y: 0,
		width: ARTWORK_WIDTH_MM + 2 * marginMM,
		height: ARTWORK_HEIGHT_MM + 2 * marginMM
	};
}

/** The trim box: the media box inset by the margin, which is the artwork area. */
function expectedTrimBox(marginMM = CROP_MARK_MARGIN_MM): PageBox {
	return {
		x: marginMM,
		y: marginMM,
		width: ARTWORK_WIDTH_MM,
		height: ARTWORK_HEIGHT_MM
	};
}

/**
 * The bleed box: the artwork grown by `bleedSizeMM` on every side (the declared bleed
 * extends that far past the trim line), placed inside the media box.
 */
function expectedBleedBox(bleedSizeMM: number, marginMM = CROP_MARK_MARGIN_MM): PageBox {
	const insetMM = Math.max(0, marginMM - bleedSizeMM);
	return {
		x: insetMM,
		y: insetMM,
		width: ARTWORK_WIDTH_MM + 2 * bleedSizeMM,
		height: ARTWORK_HEIGHT_MM + 2 * bleedSizeMM
	};
}

function assertBox(actual: PageBox, expected: PageBox, label: string) {
	const close =
		Math.abs(actual.x - expected.x) < MM_EPSILON &&
		Math.abs(actual.y - expected.y) < MM_EPSILON &&
		Math.abs(actual.width - expected.width) < MM_EPSILON &&
		Math.abs(actual.height - expected.height) < MM_EPSILON;

	assert(close, `${label}: expected ${describeBox(expected)}, got ${describeBox(actual)}`);
}

/** Compares a box read back from a PDF (points) against an expected box in millimetres. */
function assertProducedBox(actual: PageBox, expected: PageBox, label: string) {
	for (const key of ['x', 'y', 'width', 'height'] as const) {
		const actualMM = toMM(actual[key]);
		assert(
			Math.abs(actualMM - expected[key]) < PRODUCED_MM_EPSILON,
			`${label} ${key}: expected ${expected[key]} mm, got ${actualMM} mm`
		);
	}
}

function assertNotInverted(box: PageBox, label: string) {
	assert(
		box.width > 0 && box.height > 0,
		`${label}: the box must not invert, got ${describeBox(box)}`
	);
}

// --- cases --------------------------------------------------------------------

export function getPageBoxesCases(): VerifyCase[] {
	return [
		{
			name: 'page-boxes: a small fixture bleed size keeps the trim box on the artwork',
			run: () => {
				// The case used to pass the old `withPageMargin: true` flag and let the
				// function own the `CROPLINE.DISTANCE` inset; the margin is now an input, so
				// the same geometry is expressed as a crop-mark margin plus the declared bleed.
				// The name used to call this value the "app default": it is a fixture value now,
				// explicitly passed so a moved store default cannot move these expectations.
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					CROP_MARK_MARGIN_MM,
					FIXTURE_BLEED_SIZE_MM
				);

				assertBox(boxes.media, expectedMediaBox(), 'media box');
				assertBox(boxes.trim, expectedTrimBox(), 'trim box must sit on the artwork');
				assertBox(boxes.bleed, expectedBleedBox(FIXTURE_BLEED_SIZE_MM), 'bleed box');
			}
		},
		{
			name: 'page-boxes: bleed size 3 is the historical fixed point, not the rule',
			run: () => {
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					CROP_MARK_MARGIN_MM,
					HISTORICAL_BLEED_SIZE_MM
				);

				assertBox(boxes.media, expectedMediaBox(), 'media box');
				assertBox(boxes.trim, expectedTrimBox(), 'trim box');
				assertBox(boxes.bleed, expectedBleedBox(HISTORICAL_BLEED_SIZE_MM), 'bleed box');
				// At this one value the old insets (`CROPLINE.SIZE - CROPLINE.OVERLAY` for the
				// bleed, `bleedSize + that` for the trim) coincide with the correct geometry,
				// which is why the defect was invisible while 3 mm was the default.
				assertEqual(
					CROP_MARK_MARGIN_MM - HISTORICAL_BLEED_SIZE_MM,
					HISTORICAL_BLEED_SIZE_MM,
					'this is the fixed point: the two insets used to be equal'
				);
			}
		},
		{
			// New coverage for the v2 identity: a bleed that equals the margin makes the
			// bleed box coincide with the media box, because the inset is 0.
			name: 'page-boxes: a bleed equal to the margin puts the bleed box on the page',
			run: () => {
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					CROP_MARK_MARGIN_MM,
					CROP_MARK_MARGIN_MM
				);

				assertBox(boxes.media, expectedMediaBox(), 'media box');
				assertBox(boxes.trim, expectedTrimBox(), 'trim box');
				assertBox(
					boxes.bleed,
					expectedMediaBox(),
					'bleed box must coincide with the media box'
				);
				assertBox(boxes.bleed, boxes.media, 'a bleed equal to the margin must reach the page');
			}
		},
		{
			name: 'page-boxes: a zero bleed size makes the bleed box coincide with the trim box',
			run: () => {
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					CROP_MARK_MARGIN_MM,
					0
				);

				assertBox(boxes.media, expectedMediaBox(), 'media box');
				assertBox(boxes.trim, expectedTrimBox(), 'trim box');
				assertBox(boxes.bleed, expectedBleedBox(0), 'bleed box');
				assertBox(boxes.bleed, boxes.trim, 'a zero bleed must not grow past the trim box');
			}
		},
		{
			name: 'page-boxes: a bleed size larger than the margin clamps the bleed box to the page',
			run: () => {
				// This case used to encode "a bleed larger than the crop-mark distance" back
				// when the margin was always `CROPLINE.DISTANCE`. Rule 2 of the v2 contract
				// changed the caller: `pageMarginMM` now grows the page to the bleed, so the
				// margin equals the bleed and this clamp is the defensive floor for a bleed
				// that somehow exceeds the margin it was given.
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					CROP_MARK_MARGIN_MM,
					OVERSIZED_BLEED_SIZE_MM
				);

				assertBox(boxes.media, expectedMediaBox(), 'media box');
				assertBox(boxes.trim, expectedTrimBox(), 'trim box');
				assertBox(boxes.bleed, expectedMediaBox(), 'bleed box must clamp to the media box');
				assertNotInverted(boxes.bleed, 'clamped bleed box');
			}
		},
		{
			name: 'page-boxes: a negative bleed size is treated as zero and never inverts a box',
			run: () => {
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					CROP_MARK_MARGIN_MM,
					NEGATIVE_BLEED_SIZE_MM
				);

				assertBox(boxes.media, expectedMediaBox(), 'media box');
				assertBox(boxes.trim, expectedTrimBox(), 'trim box');
				assertBox(boxes.bleed, expectedBleedBox(0), 'bleed box');
				assertBox(boxes.bleed, boxes.trim, 'a negative bleed must behave as a zero bleed');
				assertNotInverted(boxes.bleed, 'negative-bleed box');
			}
		},
		{
			name: 'page-boxes: without the page margin and without a bleed all three boxes are the artwork',
			run: () => {
				// The old case passed `withPageMargin: false` together with a non-zero bleed
				// size, and the flag suppressed both. The margin and the declared bleed are
				// now separate inputs, so the "no margin, no bleed" geometry - which is what
				// `cropMarks: 0` with `bleedMode: 'none'` produces - is margin 0 with a bleed
				// that has nothing to grow into.
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					0,
					FIXTURE_BLEED_SIZE_MM
				);

				assertBox(boxes.media, expectedArtworkBox(), 'media box');
				assertBox(boxes.bleed, expectedArtworkBox(), 'bleed box');
				assertBox(boxes.trim, expectedArtworkBox(), 'trim box');
			}
		},
		{
			name: 'page-boxes: the produced PDF puts the trim box on the artwork at a fixture bleed size',
			run: async () => {
				const { bleedSettings } = await import('@/lib/stores');
				bleedSettings.set({
					document: { width: ARTWORK_WIDTH_MM, height: ARTWORK_HEIGHT_MM },
					fit: 1,
					autoRotate: 1,
					cropMarks: 1,
					bleedSize: FIXTURE_BLEED_SIZE_MM,
					bleedMode: 'none'
				});

				const fixture = await buildPaintedPdfFixture(ARTWORK_WIDTH_MM, ARTWORK_HEIGHT_MM);
				const { fileHandler } = await import('@/lib/file-helpers');
				const output = await PDFDocument.create();
				await fileHandler[FILE_TYPE.PDF](output, fixture);

				// Read the boxes back from the serialized document, not from the in-memory
				// page: the saved PDF is what the user actually receives.
				const bytes = await output.save({ addDefaultPage: false });
				const produced = await PDFDocument.load(bytes);

				assertEqual(produced.getPageCount(), 1, 'the fixture page must be preserved');
				const page = produced.getPage(0);
				assertProducedBox(page.getMediaBox(), expectedMediaBox(), 'produced media box');
				assertProducedBox(page.getTrimBox(), expectedTrimBox(), 'produced trim box');
				// This expectation moved with decision 3 of the v2 contract ("`none` declares
				// no bleed"). The case used to expect the bleed box at `art + 2 * bleedSize`,
				// the pre-v2 contract in which even `none` declared a bleed; now `none`
				// declares 0, so the produced BleedBox equals the TrimBox. The case name
				// ("the trim box on the artwork") still describes what it proves.
				assertProducedBox(page.getBleedBox(), expectedTrimBox(), 'produced bleed box');
			}
		}
	];
}
