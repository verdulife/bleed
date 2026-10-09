/**
 * Verification cases for B2 ("an empty file list produces an intentional blank PDF").
 *
 * Pressing "generate" with no files used to return early and do nothing at all. The
 * contract that replaces it: a **successful** run that publishes one blank page carrying
 * the prepress geometry of the current settings (document size, crop marks, bleed size),
 * with no artwork and nothing to report.
 *
 * The other half of the contract is the failure guard, which must stay distinguishable: a
 * run whose files were supplied but could not be processed still publishes nothing and
 * still reports `No pages were generated`. Case 4 is the one that proves the intentional
 * template did not turn that failure into a silent success.
 *
 * The cases below drive the real `generatePDF()` and read the produced file back with
 * pdf-lib, following `pdf-errors.ts` / `render-info.ts`: `URL.createObjectURL` is wrapped
 * (not replaced) so the published blob can be captured, and `alert` is wrapped so the
 * earlier recorders keep working.
 */
import { get } from 'svelte/store';
import type { BleedSettings, BoxSize, RenderInfo, UserFile } from '@/lib/types';
import { CROPLINE, FILE_TYPE, SIZE_PRESETS, toMM } from '@/lib/constants';
import { PDFDocument } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { VerifyCase } from './harness';
import { assert, assertArrayEqual, assertEqual, buildPaintedPdfFixture } from './harness';

// --- browser API test doubles -------------------------------------------------

/**
 * Bun cannot use `blob:` URLs, and the point of these cases is *whether* a preview was
 * published, so the recorder installed by `pdf-errors.ts` (the runner imports it first) is
 * wrapped instead of replaced and every module keeps its own record of the publications.
 */
const publishedBlobs: Blob[] = [];
const previousCreateObjectURL = (
	URL as unknown as { createObjectURL?: (blob: Blob) => string }
).createObjectURL;

(URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = (blob: Blob) => {
	publishedBlobs.push(blob);
	return previousCreateObjectURL?.(blob) ?? `blob:verify/blank-template/${publishedBlobs.length}`;
};

/** Wraps whatever `alert` already is, so the recorders of the other modules keep working. */
const alertMessages: string[] = [];
const previousAlert = (globalThis as unknown as { alert?: (message?: unknown) => void }).alert;

(globalThis as unknown as { alert: (message?: unknown) => void }).alert = (message?: unknown) => {
	alertMessages.push(String(message));
	previousAlert?.(message);
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

async function renderInfoOf(): Promise<RenderInfo | null> {
	const { renderInfo } = await loadStores();
	return get(renderInfo);
}

async function generationErrorsOf(): Promise<string[]> {
	const { generationErrors } = await loadStores();
	return get(generationErrors);
}

// --- fixtures & settings ------------------------------------------------------

/** The document size the user configured. */
const DOCUMENT_WIDTH_MM = 210;
const DOCUMENT_HEIGHT_MM = 297;

/**
 * A fixture bleed, deliberately different from the store default (3 mm since T2) and passed
 * explicitly by `makeSettings`, so these cases cannot follow a change of that default. Every
 * case here runs `bleedMode: 'none'`, which declares no bleed, so the value has no effect on
 * the geometry - which is exactly why it must stay explicit: nothing would catch an
 * accidental dependency on the default.
 */
const BLEED_SIZE_MM = 2;

/**
 * Every expectation is derived from the constants and comes back through a
 * point/millimetre round-trip and a PDF serialization, so the same small tolerance the
 * sibling modules use is required.
 */
const TOLERANCE_MM = 0.05;

/** Not a PDF: `PDFDocument.load` rejects it, so `fileHandler[FILE_TYPE.PDF]` throws. */
const GARBAGE_PDF = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]).buffer;

type SettingsOverrides = {
	document?: { width: number; height: number };
	cropMarks?: 0 | 1;
};

function makeSettings(overrides: SettingsOverrides = {}): BleedSettings {
	return {
		document: overrides.document ?? { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM },
		fit: 1,
		autoRotate: 1,
		cropMarks: overrides.cropMarks ?? 1,
		bleedSize: BLEED_SIZE_MM,
		bleedMode: 'none'
	};
}

function makeUserFile(fileName: string, fileBuffer: ArrayBuffer, id: number): UserFile {
	return { fileType: FILE_TYPE.PDF, fileBuffer, fileName, id };
}

/** Records `console.error` calls instead of printing the expected failures. */
const consoleErrors: unknown[][] = [];

/** Puts the stores in the state the UI would have and runs the real `generatePDF()`. */
async function runGeneration(files: UserFile[], settings: BleedSettings) {
	const stores = await loadStores();
	stores.userFiles.set(files);
	stores.bleedSettings.set(settings);
	stores.previewBlobUri.set('');
	publishedBlobs.length = 0;
	alertMessages.length = 0;
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

// --- assertions ---------------------------------------------------------------

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

function assertSize(actual: BoxSize, expected: BoxSize, label: string) {
	assertBox({ x: 0, y: 0, ...actual }, { x: 0, y: 0, ...expected }, label);
}

function documentSize(): BoxSize {
	return { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM };
}

/** The media box of a document with crop marks: the artwork grown by the crop-mark distance. */
function expectedMediaBox(size: BoxSize): ExpectedBox {
	return {
		x: 0,
		y: 0,
		width: size.width + 2 * CROPLINE.DISTANCE,
		height: size.height + 2 * CROPLINE.DISTANCE
	};
}

/** The trim box: the media box inset by the crop-mark distance, which is exactly the artwork. */
function expectedTrimBox(size: BoxSize): ExpectedBox {
	return {
		x: CROPLINE.DISTANCE,
		y: CROPLINE.DISTANCE,
		width: size.width,
		height: size.height
	};
}

/** With crop marks off every box is the artwork itself. */
function expectedPlainBox(size: BoxSize): ExpectedBox {
	return { x: 0, y: 0, width: size.width, height: size.height };
}

// --- cases --------------------------------------------------------------------

export function getBlankTemplateCases(): VerifyCase[] {
	return [
		{
			name: 'blank-template: no files, crop marks on, one printed page sized from the settings',
			run: async () => {
				await runGeneration([], makeSettings());

				// The whole point of B2: an intentional template run still produces a file.
				assertEqual(
					publishedBlobs.length,
					1,
					'an empty file list must publish the intentional blank template'
				);
				assertEqual(
					await producedPageCount(publishedBlobs[0]),
					1,
					'the template must be exactly one page'
				);

				const page = await loadProducedPage(publishedBlobs[0]);
				assertBox(boxMM(page.getTrimBox()), expectedTrimBox(documentSize()), 'template trim box');
				assertBox(boxMM(page.getMediaBox()), expectedMediaBox(documentSize()), 'template media box');

				assertArrayEqual(
					await generationErrorsOf(),
					[],
					'an intentional template is a successful run, not a failure'
				);
				assertEqual(
					alertMessages.length,
					0,
					`the template must not alert, got "${alertMessages.join(' | ')}"`
				);

				// The panel announces the size the produced file carries (B1), so the user
				// can see which document the blank template was made for.
				const info = await renderInfoOf();
				assert(info !== null, 'a successful template run must publish render info');
				assertSize(info.artwork, documentSize(), 'published template artwork');
				assertEqual(info.pageCount, 1, 'published template page count');
			}
		},
		{
			name: 'blank-template: no files and both axes empty fall back to A4 axis by axis',
			run: async () => {
				await runGeneration([], makeSettings({ document: { width: 0, height: 0 } }));

				assertEqual(
					publishedBlobs.length,
					1,
					'the template must be published even without a configured size'
				);

				const a4: BoxSize = { width: SIZE_PRESETS.A4.width, height: SIZE_PRESETS.A4.height };

				// Read from the produced file: with no artwork there is no aspect ratio to
				// derive a missing axis from, so the page can only carry the A4 fallback.
				const page = await loadProducedPage(publishedBlobs[0]);
				assertBox(boxMM(page.getTrimBox()), expectedTrimBox(a4), 'A4 fallback trim box');

				const info = await renderInfoOf();
				assert(info !== null, 'a successful template run must publish render info');
				assertSize(info.artwork, a4, 'published A4 fallback artwork');
			}
		},
		{
			name: 'blank-template: no files and crop marks off give one page the size of the document',
			run: async () => {
				await runGeneration([], makeSettings({ cropMarks: 0 }));

				assertEqual(publishedBlobs.length, 1, 'the template must still be published');
				assertEqual(
					await producedPageCount(publishedBlobs[0]),
					1,
					'the template must be exactly one page'
				);

				// Without crop marks the three boxes collapse onto the artwork.
				const page = await loadProducedPage(publishedBlobs[0]);
				assertBox(boxMM(page.getMediaBox()), expectedPlainBox(documentSize()), 'plain media box');
				assertBox(boxMM(page.getBleedBox()), expectedPlainBox(documentSize()), 'plain bleed box');
				assertBox(boxMM(page.getTrimBox()), expectedPlainBox(documentSize()), 'plain trim box');

				assertArrayEqual(await generationErrorsOf(), [], 'the run must report no error');
			}
		},
		{
			name: 'blank-template: files that all fail still publish nothing and report the failure',
			run: async () => {
				// The regression guard: the intentional template must not make the
				// "files were supplied but nothing could be processed" branch unreachable.
				await runGeneration(
					[
						makeUserFile('broken.pdf', GARBAGE_PDF, 1),
						makeUserFile('also-broken.pdf', GARBAGE_PDF, 2)
					],
					makeSettings()
				);

				assertEqual(
					publishedBlobs.length,
					0,
					'no blob may be published when every supplied file failed'
				);
				assertArrayEqual(
					await generationErrorsOf(),
					[
						'Could not process "broken.pdf"',
						'Could not process "also-broken.pdf"',
						'No pages were generated'
					],
					'the failure list must name every file and the empty document'
				);
				assertEqual(
					await renderInfoOf(),
					null,
					'a failed run must not announce the geometry of a template it never produced'
				);
				assertEqual(
					alertMessages.length,
					0,
					`the generation must not alert, got "${alertMessages.join(' | ')}"`
				);
			}
		},
		{
			name: 'blank-template: a normal run with one valid file does not gain an extra page',
			run: async () => {
				const fixture = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);
				await runGeneration([makeUserFile('poster.pdf', fixture, 1)], makeSettings());

				assertEqual(publishedBlobs.length, 1, 'a normal run must publish its file');
				assertEqual(
					await producedPageCount(publishedBlobs[0]),
					1,
					'the template path must not add a page to a run that has files'
				);

				const info = await renderInfoOf();
				assert(info !== null, 'a successful run must publish render info');
				assertEqual(info.pageCount, 1, 'the run must still have exactly its own page');
				assertArrayEqual(await generationErrorsOf(), [], 'the run must report no error');
			}
		}
	];
}
