/**
 * Verification cases for B3 ("the bleed fill becomes selectable").
 *
 * The bleed fill used to be a second boolean (`mirrorBleed`) that only had an effect while
 * the coupled `cropMarksAndBleed` boolean was on, so "crop marks without a bleed fill" and
 * "a bleed area without crop marks" were both inexpressible. The contract that replaces it:
 *
 *   - `cropMarks` and `bleedMode` are independent settings,
 *   - the page margin (the media box growing by 2 x `CROPLINE.DISTANCE`) is needed when
 *     **either** crop marks are on **or** a bleed fill is requested,
 *   - the bleed mode only decides two things: which box the artwork is fitted into
 *     (`none`/`mirror` -> trim, `natural` -> bleed) and whether the mirrored copies are
 *     drawn (`mirror` only).
 *
 * Case 1 covers those decisions as pure functions. The remaining cases drive the real
 * `generatePDF()` and read the boxes back from the produced file, following
 * `pdf-errors.ts` / `render-info.ts` (`URL.createObjectURL` is wrapped, not replaced, so
 * the published blob can be captured and re-opened independently).
 *
 * Limitation: the harness cannot read the drawn artwork out of the PDF content stream, so
 * "the artwork really covers the bleed box in `natural` mode" and "no mirrored copies were
 * drawn in `none` mode" are covered by the pure decisions plus the produced geometry, not
 * by inspecting the drawing. The visual pass is the user's.
 */
import { get } from 'svelte/store';
import type { BleedMode, BleedSettings, BoxSize, UserFile } from '@/lib/types';
import { CROPLINE, FILE_TYPE, toMM } from '@/lib/constants';
import { PDFDocument } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { VerifyCase } from './harness';
import { assert, assertArrayEqual, assertEqual, buildPaintedPdfFixture } from './harness';
import { artworkTargetBoxForBleedMode, drawsMirrorBleed, needsPageMargin } from '@/lib/bleed-mode';

// --- browser API test doubles -------------------------------------------------

/**
 * Bun cannot use `blob:` URLs, and the point of the pipeline cases is *what was published*,
 * so the recorder installed by `pdf-errors.ts` (the runner imports it first) is wrapped
 * instead of replaced and every module keeps its own record of the publications.
 */
const publishedBlobs: Blob[] = [];
const previousCreateObjectURL = (
	URL as unknown as { createObjectURL?: (blob: Blob) => string }
).createObjectURL;

(URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = (blob: Blob) => {
	publishedBlobs.push(blob);
	return previousCreateObjectURL?.(blob) ?? `blob:verify/bleed-modes/${publishedBlobs.length}`;
};

// --- module under test (loaded after the doubles are installed) ---------------

type GeneratePdfModule = typeof import('@/lib/generate-pdf');
type StoresModule = typeof import('@/lib/stores');

let loadedGenerate: Promise<GeneratePdfModule> | null = null;

function loadModuleUnderTest(): Promise<GeneratePdfModule> {
	loadedGenerate ??= import('@/lib/generate-pdf');
	return loadedGenerate;
}

async function loadStores(): Promise<StoresModule> {
	return import('@/lib/stores');
}

async function generationErrorsOf(): Promise<string[]> {
	const { generationErrors } = await loadStores();
	return get(generationErrors);
}

// --- fixtures & settings ------------------------------------------------------

/** The document size the user configured, and the size of the artwork fixture. */
const DOCUMENT_WIDTH_MM = 100;
const DOCUMENT_HEIGHT_MM = 150;

/**
 * A bleed size that is not the app default (2 mm), so case 6 proves the produced bleed box
 * really follows `bleedSize` instead of coinciding with a default by accident. It is the
 * historical fixed point of the box math, which makes the expectation exact.
 */
const NON_DEFAULT_BLEED_SIZE_MM = CROPLINE.SIZE - CROPLINE.OVERLAY;

/** All three modes, shared by the regression and the bleed-size cases. */
const ALL_MODES: BleedMode[] = ['none', 'mirror', 'natural'];

/**
 * The values come back through a point/millimetre round-trip and a PDF serialization, so
 * the same small tolerance the sibling modules use is required.
 */
const TOLERANCE_MM = 0.05;

type SettingsOverrides = {
	cropMarks?: 0 | 1;
	bleedMode?: BleedMode;
	bleedSize?: number;
};

function makeSettings(overrides: SettingsOverrides = {}): BleedSettings {
	return {
		document: { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM },
		fit: 1,
		autoRotate: 1,
		cropMarks: overrides.cropMarks ?? 1,
		bleedSize: overrides.bleedSize ?? NON_DEFAULT_BLEED_SIZE_MM,
		bleedMode: overrides.bleedMode ?? 'none'
	};
}

function makeUserFile(fileName: string, fileBuffer: ArrayBuffer, id: number): UserFile {
	return { fileType: FILE_TYPE.PDF, fileBuffer, fileName, id };
}

/** Records `console.error` calls instead of printing unexpected failures. */
const consoleErrors: unknown[][] = [];

/** Puts the stores in the state the UI would have and runs the real `generatePDF()`. */
async function runGeneration(settings: BleedSettings, files?: UserFile[]) {
	const stores = await loadStores();
	const artwork = files ?? [
		makeUserFile(
			'artwork.pdf',
			await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM),
			1
		)
	];

	stores.userFiles.set(artwork);
	stores.bleedSettings.set(settings);
	stores.previewBlobUri.set('');
	publishedBlobs.length = 0;
	consoleErrors.length = 0;

	const originalConsoleError = console.error;
	console.error = (...args: unknown[]) => {
		consoleErrors.push(args);
	};
	try {
		const { generatePDF } = await loadModuleUnderTest();
		await generatePDF();
	} finally {
		console.error = originalConsoleError;
	}
}

/** Re-opens the produced file independently of `generatePDF`. */
async function loadProducedPage(blob: Blob): Promise<PDFPage> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const produced = await PDFDocument.load(bytes);
	return produced.getPage(0);
}

async function producedPageCount(blob: Blob): Promise<number> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const produced = await PDFDocument.load(bytes);
	return produced.getPageCount();
}

// --- expected boxes (all derived from CROPLINE.DISTANCE) ----------------------

type ExpectedBox = { x: number; y: number; width: number; height: number };

/** pdf-lib returns points; every expectation in this module is in millimetres. */
function boxMM(box: ExpectedBox): ExpectedBox {
	return { x: toMM(box.x), y: toMM(box.y), width: toMM(box.width), height: toMM(box.height) };
}

function assertBox(actual: ExpectedBox, expected: ExpectedBox, label: string) {
	const close =
		Math.abs(actual.x - expected.x) < TOLERANCE_MM &&
		Math.abs(actual.y - expected.y) < TOLERANCE_MM &&
		Math.abs(actual.width - expected.width) < TOLERANCE_MM &&
		Math.abs(actual.height - expected.height) < TOLERANCE_MM;

	assert(
		close,
		`${label}: expected x=${expected.x} y=${expected.y} ${expected.width} x ${expected.height} mm, ` +
			`got x=${actual.x} y=${actual.y} ${actual.width} x ${actual.height} mm`
	);
}

function artworkSize(): BoxSize {
	return { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM };
}

/**
 * The trim box: the media box inset by the crop-mark distance, which is exactly the
 * artwork area, whatever the bleed mode is. The bleed mode moves the artwork, not the trim.
 */
function expectedTrimBox(): ExpectedBox {
	return {
		x: CROPLINE.DISTANCE,
		y: CROPLINE.DISTANCE,
		width: DOCUMENT_WIDTH_MM,
		height: DOCUMENT_HEIGHT_MM
	};
}

/**
 * The media box once the page margin is applied: the artwork plus the crop-mark distance on
 * every side, which is the room the crop marks need and the room a bleed fill is drawn in.
 */
function expectedMediaBox(): ExpectedBox {
	return {
		x: 0,
		y: 0,
		width: DOCUMENT_WIDTH_MM + 2 * CROPLINE.DISTANCE,
		height: DOCUMENT_HEIGHT_MM + 2 * CROPLINE.DISTANCE
	};
}

/** The bleed box: the artwork grown by `bleedSizeMM` on every side. */
function expectedBleedBox(bleedSizeMM: number): ExpectedBox {
	const insetMM = CROPLINE.DISTANCE - bleedSizeMM;
	return {
		x: insetMM,
		y: insetMM,
		width: DOCUMENT_WIDTH_MM + 2 * bleedSizeMM,
		height: DOCUMENT_HEIGHT_MM + 2 * bleedSizeMM
	};
}

/**
 * The geometry every mode shares: room for the marks, the trim box on the artwork, and a
 * single page. Only the artwork target box and the mirror fill differ between modes.
 */
async function assertSharedGeometry(label: string, bleedSizeMM: number) {
	assertEqual(publishedBlobs.length, 1, `${label}: the run must publish exactly one file`);
	assertEqual(
		await producedPageCount(publishedBlobs[0]),
		1,
		`${label}: the mirror copies must not add a page`
	);

	const page = await loadProducedPage(publishedBlobs[0]);
	assertBox(boxMM(page.getMediaBox()), expectedMediaBox(), `${label} media box`);
	assertBox(boxMM(page.getTrimBox()), expectedTrimBox(), `${label} trim box`);
	assertBox(boxMM(page.getBleedBox()), expectedBleedBox(bleedSizeMM), `${label} bleed box`);
	assertArrayEqual(await generationErrorsOf(), [], `${label}: the run must report no error`);
}

// --- cases --------------------------------------------------------------------

export function getBleedModeCases(): VerifyCase[] {
	return [
		{
			name: 'bleed-modes: the mode decides the artwork target box, the mirror fill and the page margin (pure)',
			run: () => {
				assertEqual(
					artworkTargetBoxForBleedMode('none'),
					'trim',
					'none fits the artwork into the trim box'
				);
				assertEqual(
					artworkTargetBoxForBleedMode('mirror'),
					'trim',
					'mirror fits the artwork into the trim box and fills around it'
				);
				assertEqual(
					artworkTargetBoxForBleedMode('natural'),
					'bleed',
					'natural fits the artwork into the bleed box'
				);

				assertEqual(drawsMirrorBleed('none'), false, 'none draws no mirrored copy');
				assertEqual(drawsMirrorBleed('mirror'), true, 'mirror draws the mirrored copies');
				assertEqual(drawsMirrorBleed('natural'), false, 'natural draws no mirrored copy');

				// The page-margin gate: the margin exists for the crop marks and/or the bleed
				// area, so either concern on its own is enough. This is the decision the old
				// coupled boolean could not express.
				assertEqual(needsPageMargin(0, 'none'), false, 'no marks and no fill need no margin');
				assertEqual(needsPageMargin(1, 'none'), true, 'crop marks alone need the margin');
				assertEqual(needsPageMargin(0, 'mirror'), true, 'a mirror fill alone needs the margin');
				assertEqual(needsPageMargin(0, 'natural'), true, 'a natural fill alone needs the margin');
			}
		},
		{
			name: 'bleed-modes: a mirror fill without crop marks still grows the page and keeps the trim on the artwork',
			run: async () => {
				await runGeneration(makeSettings({ cropMarks: 0, bleedMode: 'mirror' }));

				// The case the coupled boolean could not produce: marks off, fill on. The
				// bleed area exists, so the media box grows although no mark is drawn.
				await assertSharedGeometry('mirror without crop marks', NON_DEFAULT_BLEED_SIZE_MM);
				assertEqual(
					drawsMirrorBleed('mirror'),
					true,
					'the fill the run requested is the mirror fill'
				);
			}
		},
		{
			name: 'bleed-modes: crop marks without any bleed fill grow the page and leave the trim on the artwork',
			run: async () => {
				await runGeneration(makeSettings({ cropMarks: 1, bleedMode: 'none' }));

				// The other combination the coupled boolean could not produce: marks on, no
				// fill. The geometry is identical to the mirror case above.
				await assertSharedGeometry('crop marks without a fill', NON_DEFAULT_BLEED_SIZE_MM);
				assertEqual(
					artworkTargetBoxForBleedMode('none'),
					'trim',
					'a `none` fill keeps fitting the artwork into the trim box'
				);
				assertEqual(drawsMirrorBleed('none'), false, 'a `none` fill requests no mirror copy');
			}
		},
		{
			name: 'bleed-modes: a natural fill grows the page, keeps the trim on the artwork and succeeds',
			run: async () => {
				await runGeneration(makeSettings({ bleedMode: 'natural' }));

				// Only the artwork target box changes: the artwork is fitted into the bleed
				// box instead of the trim box, so the produced boxes stay where they were.
				await assertSharedGeometry('natural fill', NON_DEFAULT_BLEED_SIZE_MM);
				assertEqual(
					artworkTargetBoxForBleedMode('natural'),
					'bleed',
					'the natural run fits the artwork into the bleed box'
				);
				assertEqual(drawsMirrorBleed('natural'), false, 'a natural fill draws no mirror copy');
			}
		},
		{
			name: 'bleed-modes: all three modes produce one page with the trim on the artwork and room for the marks',
			run: async () => {
				for (const mode of ALL_MODES) {
					await runGeneration(makeSettings({ cropMarks: 1, bleedMode: mode }));
					await assertSharedGeometry(`${mode} mode`, NON_DEFAULT_BLEED_SIZE_MM);
				}
			}
		},
		{
			name: 'bleed-modes: bleedSize keeps shaping the produced bleed box in every mode',
			run: async () => {
				for (const mode of ALL_MODES) {
					await runGeneration(
						makeSettings({
							cropMarks: 1,
							bleedMode: mode,
							bleedSize: NON_DEFAULT_BLEED_SIZE_MM
						})
					);

					await assertSharedGeometry(`${mode} mode with bleedSize`, NON_DEFAULT_BLEED_SIZE_MM);

					// The binding decision: `bleedSize` defines the BleedBox the printer reads
					// in every mode, so even `none` - "do not fill the bleed area" - still
					// declares one.
					const page = await loadProducedPage(publishedBlobs[0]);
					const producedBleed = boxMM(page.getBleedBox());
					const producedTrim = boxMM(page.getTrimBox());
					assert(
						Math.abs(producedBleed.width - producedTrim.width) > TOLERANCE_MM &&
							Math.abs(producedBleed.height - producedTrim.height) > TOLERANCE_MM,
						`${mode} mode: a non-default bleed size must shape the bleed box, got ` +
							`${producedBleed.width} x ${producedBleed.height} mm against a trim box of ` +
							`${producedTrim.width} x ${producedTrim.height} mm`
					);
				}
			}
		}
	];
}
