/**
 * Verification cases for defect D3 ("the prepress boxes are only correct when
 * `bleedSize === 3`").
 *
 * `addCropMarks` (`src/lib/crop-marks.ts`) draws every mark `CROPLINE.DISTANCE` away from
 * the media edge, so the trim line it marks is exactly `CROPLINE.DISTANCE` from that edge.
 * The output boxes must follow that same convention for every bleed size, not only for the
 * historical fixed point `CROPLINE.SIZE - CROPLINE.OVERLAY` (3 mm).
 *
 * The first six cases are pure and drive `computePageBoxes` directly; every expected value
 * is derived from `CROPLINE.DISTANCE` and the bleed size, so there is no magic millimetre
 * in the expectations. The last case is the acceptance check the pure function cannot give
 * on its own: it runs the real `fileHandler[FILE_TYPE.PDF]` with crop marks on and the app
 * default bleed size, then reads the produced PDF back and asserts the boxes that were
 * actually serialized.
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
 * The bleed size the app ships with (`src/lib/stores.ts`: `bleedSettings.bleedSize = 2`).
 * This is the case the defect reports: the default was changed away from 3, and the trim
 * box then left the artwork, so the default itself is the failing scenario.
 */
const DEFAULT_BLEED_SIZE_MM = 2;

/**
 * The historical fixed point: the old code used `CROPLINE.SIZE - CROPLINE.OVERLAY` as the
 * bleed-box inset and `bleedSize + that` as the trim-box inset, so the boxes were only
 * exact when the bleed size happened to equal that crop-mark size.
 */
const HISTORICAL_BLEED_SIZE_MM = CROPLINE.SIZE - CROPLINE.OVERLAY;

/** Deliberately larger than `CROPLINE.DISTANCE`, to exercise the clamp. */
const OVERSIZED_BLEED_SIZE_MM = 15;

/** Below zero: must be treated as no bleed at all, never as an inverted box. */
const NEGATIVE_BLEED_SIZE_MM = -DEFAULT_BLEED_SIZE_MM;

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

/** The media box: the artwork plus the crop-mark distance on every side. */
function expectedMediaBox(): PageBox {
	return {
		x: 0,
		y: 0,
		width: ARTWORK_WIDTH_MM + 2 * CROPLINE.DISTANCE,
		height: ARTWORK_HEIGHT_MM + 2 * CROPLINE.DISTANCE
	};
}

/**
 * The trim box: the media box inset by `CROPLINE.DISTANCE`, which is the artwork area,
 * so the crop marks drawn at that distance land exactly on the artwork edge.
 */
function expectedTrimBox(): PageBox {
	return {
		x: CROPLINE.DISTANCE,
		y: CROPLINE.DISTANCE,
		width: ARTWORK_WIDTH_MM,
		height: ARTWORK_HEIGHT_MM
	};
}

/**
 * The bleed box: the artwork grown by `bleedSizeMM` on every side (the bleed extends that
 * far past the trim line), placed inside the media box.
 */
function expectedBleedBox(bleedSizeMM: number): PageBox {
	const insetMM = CROPLINE.DISTANCE - bleedSizeMM;
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
			name: 'page-boxes: bleed size 2 (app default) keeps the trim box on the artwork',
			run: () => {
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					DEFAULT_BLEED_SIZE_MM,
					true
				);

				assertBox(boxes.media, expectedMediaBox(), 'media box');
				assertBox(boxes.trim, expectedTrimBox(), 'trim box must sit on the artwork');
				assertBox(boxes.bleed, expectedBleedBox(DEFAULT_BLEED_SIZE_MM), 'bleed box');
			}
		},
		{
			name: 'page-boxes: bleed size 3 is the historical fixed point, not the rule',
			run: () => {
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					HISTORICAL_BLEED_SIZE_MM,
					true
				);

				assertBox(boxes.media, expectedMediaBox(), 'media box');
				assertBox(boxes.trim, expectedTrimBox(), 'trim box');
				assertBox(boxes.bleed, expectedBleedBox(HISTORICAL_BLEED_SIZE_MM), 'bleed box');
				// At this one value the old insets (`CROPLINE.SIZE - CROPLINE.OVERLAY` for the
				// bleed, `bleedSize + that` for the trim) coincide with the correct geometry,
				// which is why the defect was invisible while 3 mm was the default.
				assertEqual(
					CROPLINE.DISTANCE - HISTORICAL_BLEED_SIZE_MM,
					HISTORICAL_BLEED_SIZE_MM,
					'this is the fixed point: the two insets used to be equal'
				);
			}
		},
		{
			name: 'page-boxes: a zero bleed size makes the bleed box coincide with the trim box',
			run: () => {
				const boxes = computePageBoxes(ARTWORK_WIDTH_MM, ARTWORK_HEIGHT_MM, 0, true);

				assertBox(boxes.media, expectedMediaBox(), 'media box');
				assertBox(boxes.trim, expectedTrimBox(), 'trim box');
				assertBox(boxes.bleed, expectedBleedBox(0), 'bleed box');
				assertBox(boxes.bleed, boxes.trim, 'a zero bleed must not grow past the trim box');
			}
		},
		{
			name: 'page-boxes: a bleed size larger than the crop-mark distance clamps the bleed box',
			run: () => {
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					OVERSIZED_BLEED_SIZE_MM,
					true
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
					NEGATIVE_BLEED_SIZE_MM,
					true
				);

				assertBox(boxes.media, expectedMediaBox(), 'media box');
				assertBox(boxes.trim, expectedTrimBox(), 'trim box');
				assertBox(boxes.bleed, expectedBleedBox(0), 'bleed box');
				assertBox(boxes.bleed, boxes.trim, 'a negative bleed must behave as a zero bleed');
				assertNotInverted(boxes.bleed, 'negative-bleed box');
			}
		},
		{
			name: 'page-boxes: without the page margin all three boxes are the artwork at the origin',
			run: () => {
				// The flag is the page-margin flag, not a crop-marks flag (`needsPageMargin`):
				// with no marks and no bleed fill the page is just the artwork.
				const boxes = computePageBoxes(
					ARTWORK_WIDTH_MM,
					ARTWORK_HEIGHT_MM,
					DEFAULT_BLEED_SIZE_MM,
					false
				);

				assertBox(boxes.media, expectedArtworkBox(), 'media box');
				assertBox(boxes.bleed, expectedArtworkBox(), 'bleed box');
				assertBox(boxes.trim, expectedArtworkBox(), 'trim box');
			}
		},
		{
			name: 'page-boxes: the produced PDF puts the trim box on the artwork at the default bleed size',
			run: async () => {
				const { bleedSettings } = await import('@/lib/stores');
				bleedSettings.set({
					document: { width: ARTWORK_WIDTH_MM, height: ARTWORK_HEIGHT_MM },
					fit: 1,
					autoRotate: 1,
					cropMarks: 1,
					bleedSize: DEFAULT_BLEED_SIZE_MM,
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
				assertProducedBox(
					page.getBleedBox(),
					expectedBleedBox(DEFAULT_BLEED_SIZE_MM),
					'produced bleed box'
				);
			}
		}
	];
}
