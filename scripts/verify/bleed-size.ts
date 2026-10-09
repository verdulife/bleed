/**
 * Verification cases for T2 ("the bleed amount gets a control, and its default is 3 mm").
 *
 * The app always carried a `bleedSize` value - the store shipped it as 2 mm - but no input
 * anywhere in the UI could change it: the only control that ever existed,
 * `src/components/InputSize.svelte`, was deleted during the first feature's housekeeping
 * because nothing referenced it. T2 gives the value a control again and moves the default
 * from 2 mm to 3 mm.
 *
 * The cases cover the observable halves of that contract:
 *
 *   1. the store really ships with 3 mm, read from the store instance itself rather than
 *      from a copy of the number;
 *   2. `normalizeBleedSizeMM` (`src/lib/bleed-mode.ts`) is the single gate every change goes
 *      through: clamped at 0, rounded to a tenth of a millimetre, and a non-finite value
 *      degraded to 0 instead of reaching the box math;
 *   3. the value reaches the produced geometry: a non-default 5 mm bleed moves the media and
 *      bleed boxes of the real `generatePDF()` output, and the 3 mm default produces the
 *      documented `art + 2 * CROPLINE.DISTANCE` media box with an `art + 6 mm` bleed box.
 *
 * Not covered here: the component's own behaviour (`src/components/InputSize.svelte`). This
 * project has no component-test harness, so typing, the disabled state and the `mm` suffix
 * are covered only by `pnpm check`, `pnpm build` and the user's manual pass - this module
 * does not claim to test the interaction.
 *
 * The plumbing follows `pdf-errors.ts` / `bleed-modes.ts`: `URL.createObjectURL` is wrapped
 * (the runner imports `pdf-errors.ts` first, and `bleed-modes.ts` wraps it again) so the
 * published blob can be re-opened with pdf-lib independently of `generatePDF`, and every
 * expectation is derived from the constants with the sibling modules' tolerance.
 */
import { get } from 'svelte/store';
import { bleedSettings } from '@/lib/stores';
import type { BleedSettings, UserFile } from '@/lib/types';
import { CROPLINE, FILE_TYPE, toMM } from '@/lib/constants';
import { PDFDocument } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { PageBox } from '@/lib/page-boxes';
import type { VerifyCase } from './harness';
import { assert, assertArrayEqual, assertEqual, buildPaintedPdfFixture } from './harness';

// --- the store default, read once before any case can move it ------------------

/**
 * `bleedSettings` as `src/lib/stores.ts` ships it. It is read at import time on purpose:
 * every sibling verification module calls `bleedSettings.set()` while its cases run, so a
 * read *inside* a case would observe whatever fixture happened to run last, never the
 * default. Module-scope code runs before the runner invokes a single case, which is the only
 * moment the shipped default is observable.
 */
const STORE_DEFAULT_BLEED_SIZE_MM = get(bleedSettings).bleedSize;

// --- browser API test doubles -------------------------------------------------

/**
 * Bun cannot use `blob:` URLs, and the point of the pipeline cases is *what was published*,
 * so the recorder installed earlier (by `pdf-errors.ts`, wrapped by `bleed-modes.ts`) is
 * wrapped again instead of replaced and every module keeps its own record.
 */
const publishedBlobs: Blob[] = [];
const previousCreateObjectURL = (
	URL as unknown as { createObjectURL?: (blob: Blob) => string }
).createObjectURL;

(URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = (blob: Blob) => {
	publishedBlobs.push(blob);
	return previousCreateObjectURL?.(blob) ?? `blob:verify/bleed-size/${publishedBlobs.length}`;
};

// --- module under test (loaded dynamically, after the doubles) ----------------

type BleedModeModule = typeof import('@/lib/bleed-mode');

let loadedBleedMode: Promise<BleedModeModule> | null = null;

/**
 * `bleed-mode.ts` is imported dynamically, like the other modules do for their module under
 * test: a missing export then surfaces as a failed case instead of aborting the whole
 * runner at import time.
 */
function loadBleedMode(): Promise<BleedModeModule> {
	loadedBleedMode ??= import('@/lib/bleed-mode');
	return loadedBleedMode;
}

type GeneratePdfModule = typeof import('@/lib/generate-pdf');
type StoresModule = typeof import('@/lib/stores');

let loadedGenerate: Promise<GeneratePdfModule> | null = null;

function loadGeneratePdf(): Promise<GeneratePdfModule> {
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
 * The default written out as an expectation: the store's value is asserted against this in
 * case 1, and the geometry the default must produce is asserted against it in case 4. The
 * two directions are deliberately separate - case 4 never derives its expectation from the
 * store, so a moved default cannot move the geometry expectation with it.
 */
const DEFAULT_BLEED_MM = 3;

/**
 * Not the default and below `CROPLINE.DISTANCE`, so the page still grows for the crop marks
 * and only the bleed box moves: the case isolates the bleed value from the margin.
 */
const NON_DEFAULT_BLEED_MM = 5;

/** The values come back through a point/millimetre round-trip and a PDF serialization. */
const TOLERANCE_MM = 0.05;

function makeSettings(bleedSizeMM: number): BleedSettings {
	return {
		document: { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM },
		fit: 1,
		autoRotate: 1,
		cropMarks: 1,
		bleedSize: bleedSizeMM,
		// `none` declares no bleed (T1 decision 3), so its produced BleedBox would stay on
		// the TrimBox and the bleed size would be unobservable. `mirror` declares the bleed,
		// which is what makes the value reaching the geometry checkable.
		bleedMode: 'mirror'
	};
}

function makeUserFile(fileName: string, fileBuffer: ArrayBuffer, id: number): UserFile {
	return { fileType: FILE_TYPE.PDF, fileBuffer, fileName, id };
}

/** Records `console.error` calls instead of printing unexpected failures. */
const consoleErrors: unknown[][] = [];

/** Puts the stores in the state the UI would have and runs the real `generatePDF()`. */
async function runGeneration(settings: BleedSettings) {
	const stores = await loadStores();
	const artwork = [
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
		const { generatePDF } = await loadGeneratePdf();
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

// --- expected boxes, derived from the constants -------------------------------

/**
 * The media box for a margin `marginMM` per side, in millimetres: the artwork plus the
 * margin on every side.
 */
function expectedMediaBox(marginMM: number): PageBox {
	return {
		x: 0,
		y: 0,
		width: DOCUMENT_WIDTH_MM + 2 * marginMM,
		height: DOCUMENT_HEIGHT_MM + 2 * marginMM
	};
}

/**
 * The bleed box: the media box inset by `max(0, margin - bleed)`, which is the artwork grown
 * by `bleedMM` on every side as long as the bleed does not exceed the margin.
 */
function expectedBleedBox(marginMM: number, bleedMM: number): PageBox {
	const insetMM = Math.max(0, marginMM - bleedMM);
	return {
		x: insetMM,
		y: insetMM,
		width: DOCUMENT_WIDTH_MM + 2 * bleedMM,
		height: DOCUMENT_HEIGHT_MM + 2 * bleedMM
	};
}

/** pdf-lib returns points; every expectation in this module is in millimetres. */
function boxMM(box: PageBox): PageBox {
	return { x: toMM(box.x), y: toMM(box.y), width: toMM(box.width), height: toMM(box.height) };
}

function assertBox(actual: PageBox, expected: PageBox, label: string) {
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

// --- cases --------------------------------------------------------------------

export function getBleedSizeCases(): VerifyCase[] {
	return [
		{
			name: 'bleed-size: the store ships with a 3 mm bleed',
			run: () => {
				// Read from the store instance, not from a copy of the number: if
				// `stores.ts` still shipped 2 mm, this is the case that fails.
				assertEqual(
					STORE_DEFAULT_BLEED_SIZE_MM,
					DEFAULT_BLEED_MM,
					'the default bleedSize the store ships with must be 3 mm'
				);
			}
		},
		{
			name: 'bleed-size: normalizeBleedSizeMM clamps negatives, rounds to a tenth and degrades non-finite input',
			run: async () => {
				const { normalizeBleedSizeMM } = await loadBleedMode();

				assertEqual(
					normalizeBleedSizeMM(-NON_DEFAULT_BLEED_MM),
					0,
					'a negative bleed must be clamped to 0, never a negative box'
				);
				assertEqual(
					normalizeBleedSizeMM(-0.04),
					0,
					'a tiny negative must be clamped to 0 as well'
				);
				assertEqual(
					normalizeBleedSizeMM(2.04),
					2,
					'a value below the second decimal must round down to 2'
				);
				assertEqual(
					normalizeBleedSizeMM(3.14159),
					3.1,
					'the value must keep exactly one decimal: 3.14159 -> 3.1'
				);
				assertEqual(
					normalizeBleedSizeMM(0.25),
					0.3,
					'a tenth must round to the nearest tenth'
				);
				// A non-finite value reaches the box math as `NaN` if it is not caught here,
				// which pdf-lib would serialize as an invalid page instead of failing loudly.
				assertEqual(
					normalizeBleedSizeMM(Number.NaN),
					0,
					'NaN must degrade to 0 instead of reaching the box math'
				);
				assertEqual(
					normalizeBleedSizeMM(Number.POSITIVE_INFINITY),
					0,
					'an infinite bleed must degrade to 0 as well'
				);
				assertEqual(
					normalizeBleedSizeMM(Number.NEGATIVE_INFINITY),
					0,
					'a negatively infinite bleed must degrade to 0'
				);
			}
		},
		{
			name: 'bleed-size: a non-default 5 mm bleed reaches the produced media and bleed boxes',
			run: async () => {
				await runGeneration(makeSettings(NON_DEFAULT_BLEED_MM));

				assertEqual(publishedBlobs.length, 1, 'the run must publish exactly one file');
				const page = await loadProducedPage(publishedBlobs[0]);
				const marginMM = Math.max(CROPLINE.DISTANCE, NON_DEFAULT_BLEED_MM);

				// The margin follows the mark distance (5 < 6), so the page grows for the
				// marks and the bleed only moves the BleedBox.
				assertBox(
					boxMM(page.getMediaBox()),
					expectedMediaBox(marginMM),
					`media box at a ${NON_DEFAULT_BLEED_MM} mm bleed`
				);
				// The value reaching the geometry is the point: the BleedBox must be the
				// artwork grown by exactly 2 x 5 mm.
				assertBox(
					boxMM(page.getBleedBox()),
					expectedBleedBox(marginMM, NON_DEFAULT_BLEED_MM),
					`bleed box at a ${NON_DEFAULT_BLEED_MM} mm bleed`
				);
				assertArrayEqual(await generationErrorsOf(), [], 'the run must report no error');
			}
		},
		{
			name: 'bleed-size: the 3 mm default with crop marks on gives art + 2 * CROPLINE.DISTANCE media and art + 6 mm bleed',
			run: async () => {
				// Runs with the value the store actually ships, but asserts against the 3 mm
				// written above: a default that moved to another number would fail here
				// instead of silently relabelling the expectation.
				await runGeneration(makeSettings(STORE_DEFAULT_BLEED_SIZE_MM));

				assertEqual(publishedBlobs.length, 1, 'the run must publish exactly one file');
				const page = await loadProducedPage(publishedBlobs[0]);

				assertBox(
					boxMM(page.getMediaBox()),
					expectedMediaBox(CROPLINE.DISTANCE),
					'media box at the default bleed'
				);
				assertBox(
					boxMM(page.getBleedBox()),
					expectedBleedBox(CROPLINE.DISTANCE, DEFAULT_BLEED_MM),
					'bleed box at the default bleed'
				);
				assertArrayEqual(await generationErrorsOf(), [], 'the run must report no error');
			}
		}
	];
}
