/**
 * Verification cases for B1 ("show the sizes that were actually produced").
 *
 * The user wants to see, after a render, the document size **without** crop marks and
 * **with** crop marks - it matters most when one axis is empty and the app derives it from
 * the artwork aspect ratio, because today that decision is invisible. The hard constraint
 * is that those numbers must be read back from the produced PDF (`page.getMediaBox()`,
 * `page.getTrimBox()`, `page.getBleedBox()` on the generated document), never recomputed in
 * the UI from the same formula that drives generation.
 *
 * The cases drive the real `generatePDF()` and inspect the `renderInfo` store plus the
 * published blob that `generatePDF` captured with `URL.createObjectURL` (doubled below,
 * following `pdf-errors.ts`). Case 6 reloads the produced bytes and compares them against
 * the published numbers, which is what proves the panel is not deriving anything.
 */
import { get } from 'svelte/store';
import type { BleedSettings, BoxSize, RenderInfo, UserFile } from '@/lib/types';
import { CROPLINE, FILE_TYPE, toMM } from '@/lib/constants';
import { PDFDocument } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { VerifyCase } from './harness';
import { assert, assertArrayEqual, assertEqual, buildPaintedPdfFixture } from './harness';

// --- browser API test doubles -------------------------------------------------

/**
 * `generatePDF` publishes the preview through `URL.createObjectURL`, which Bun cannot use
 * for `blob:` URLs; capturing the blob is the only way to re-open the produced file and
 * check the published numbers against it. This wraps the recorder installed by
 * `pdf-errors.ts` (the runner imports that module first) instead of replacing it, so both
 * modules keep their own record of what was published.
 */
const publishedBlobs: Blob[] = [];
const previousCreateObjectURL = (
	URL as unknown as { createObjectURL?: (blob: Blob) => string }
).createObjectURL;

(URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = (blob: Blob) => {
	publishedBlobs.push(blob);
	return previousCreateObjectURL?.(blob) ?? `blob:verify/render-info/${publishedBlobs.length}`;
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

/** The document size the user configured, and the size of the fixture in the crop-mark cases. */
const DOCUMENT_WIDTH_MM = 210;
const DOCUMENT_HEIGHT_MM = 297;

/**
 * A fixture size that appears nowhere in the settings: both document axes are left empty,
 * so the only place this value can come from is the produced page itself. Landscape keeps
 * it distinguishable from the document size above.
 */
const FIXTURE_WIDTH_MM = 200;
const FIXTURE_HEIGHT_MM = 100;

/** The bleed size the app ships with (`bleedSettings.bleedSize` in `src/lib/stores.ts`). */
const BLEED_SIZE_MM = 2;

/**
 * Every expectation is derived from the constants, and the values come back through a
 * point/millimetre round-trip and a PDF serialization, so a small tolerance is required.
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

// --- assertions ---------------------------------------------------------------

function assertSize(actual: BoxSize, expected: BoxSize, label: string) {
	const close =
		Math.abs(actual.width - expected.width) < TOLERANCE_MM &&
		Math.abs(actual.height - expected.height) < TOLERANCE_MM;

	assert(
		close,
		`${label}: expected ${expected.width} x ${expected.height} mm, got ${actual.width} x ${actual.height} mm`
	);
}

/** The media box: the artwork plus the crop-mark distance on every side. */
function expectedMediaSize(): BoxSize {
	return {
		width: DOCUMENT_WIDTH_MM + 2 * CROPLINE.DISTANCE,
		height: DOCUMENT_HEIGHT_MM + 2 * CROPLINE.DISTANCE
	};
}

/** The bleed box: the media box inset by `CROPLINE.DISTANCE - bleedSize`. */
function expectedBleedSize(): BoxSize {
	const insetMM = CROPLINE.DISTANCE - BLEED_SIZE_MM;
	return {
		width: expectedMediaSize().width - 2 * insetMM,
		height: expectedMediaSize().height - 2 * insetMM
	};
}

function documentSize(): BoxSize {
	return { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM };
}

// --- cases --------------------------------------------------------------------

export function getRenderInfoCases(): VerifyCase[] {
	return [
		{
			name: 'render-info: a generated document publishes its own artwork, media and bleed sizes',
			run: async () => {
				const fixture = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);
				await runGeneration([makeUserFile('poster.pdf', fixture, 1)], makeSettings());

				assertEqual(publishedBlobs.length, 1, 'the run must publish its produced file');
				const info = await renderInfoOf();
				assert(info !== null, 'a successful run must publish render info');

				assertSize(info.artwork, documentSize(), 'artwork (the trim box)');
				assertSize(info.media, expectedMediaSize(), 'media box (with crop marks)');
				assertSize(info.bleed, expectedBleedSize(), 'bleed box');
				assertEqual(info.pageCount, 1, 'page count');
			}
		},
		{
			name: 'render-info: an axis derived from the artwork is announced with the value the file carries',
			run: async () => {
				const fixture = await buildPaintedPdfFixture(FIXTURE_WIDTH_MM, FIXTURE_HEIGHT_MM);

				// Both axes are empty, so the document size is derived from the artwork. The
				// published size can only be right if it was read back from the output page.
				await runGeneration(
					[makeUserFile('artwork.pdf', fixture, 1)],
					makeSettings({ document: { width: 0, height: 0 } })
				);

				const info = await renderInfoOf();
				assert(info !== null, 'a successful run must publish render info');

				const artworkSize: BoxSize = { width: FIXTURE_WIDTH_MM, height: FIXTURE_HEIGHT_MM };
				assertSize(info.artwork, artworkSize, 'artwork derived from the artwork aspect ratio');
				assertSize(
					info.media,
					{
						width: FIXTURE_WIDTH_MM + 2 * CROPLINE.DISTANCE,
						height: FIXTURE_HEIGHT_MM + 2 * CROPLINE.DISTANCE
					},
					'media box derived from the artwork aspect ratio'
				);
			}
		},
		{
			name: 'render-info: without crop marks the published sizes are the document itself',
			run: async () => {
				const fixture = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);
				await runGeneration(
					[makeUserFile('poster.pdf', fixture, 1)],
					makeSettings({ cropMarks: 0 })
				);

				const info = await renderInfoOf();
				assert(info !== null, 'a successful run must publish render info');

				assertSize(info.artwork, documentSize(), 'artwork without crop marks');
				assertSize(info.media, documentSize(), 'media box without crop marks');
				assertSize(info.bleed, documentSize(), 'bleed box without crop marks');
			}
		},
		{
			// B2 moved this case: an empty file list no longer leaves the panel empty, it
			// produces an intentional blank template whose size the panel announces. The
			// "clears the previous run" half is still asserted: the template publishes its own
			// geometry (the configured document size) instead of the previous run's.
			name: 'render-info: an empty file list replaces the previous panel with the template size',
			run: async () => {
				const fixture = await buildPaintedPdfFixture(FIXTURE_WIDTH_MM, FIXTURE_HEIGHT_MM);
				await runGeneration(
					[makeUserFile('artwork.pdf', fixture, 1)],
					makeSettings({ document: { width: 0, height: 0 } })
				);
				assert(
					(await renderInfoOf()) !== null,
					'the successful run must populate render info in the first place'
				);

				await runGeneration([], makeSettings());

				const info = await renderInfoOf();
				assert(info !== null, 'the intentional template must publish its own geometry');
				assertSize(info.artwork, documentSize(), 'the template artwork');
				assertEqual(publishedBlobs.length, 1, 'the intentional template must be published');
				assertArrayEqual(
					await generationErrorsOf(),
					[],
					'an intentional template must not be reported as a failure'
				);
			}
		},
		{
			name: 'render-info: a failed run clears the sizes of the previous, successful one',
			run: async () => {
				const fixture = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);
				await runGeneration([makeUserFile('poster.pdf', fixture, 1)], makeSettings());
				assert(
					(await renderInfoOf()) !== null,
					'the successful run must populate render info in the first place'
				);

				await runGeneration([makeUserFile('broken.pdf', GARBAGE_PDF, 2)], makeSettings());

				assertEqual(
					await renderInfoOf(),
					null,
					'a failed run must not leave stale geometry in the panel'
				);
				assertEqual(publishedBlobs.length, 0, 'a failed run must publish nothing');
				const errors = await generationErrorsOf();
				assert(errors.length > 0, `the failure must still be reported, got [${errors.join(', ')}]`);
			}
		},
		{
			name: 'render-info: the published numbers match the produced PDF instead of being recomputed',
			run: async () => {
				const fixture = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);
				await runGeneration([makeUserFile('poster.pdf', fixture, 1)], makeSettings());

				assertEqual(publishedBlobs.length, 1, 'the run must publish its produced file');
				const info = await renderInfoOf();
				assert(info !== null, 'a successful run must publish render info');

				// Independent read: the boxes of the serialized output, reloaded with pdf-lib.
				const page = await loadProducedPage(publishedBlobs[0]);
				const trim = page.getTrimBox();
				const media = page.getMediaBox();

				assertSize(
					info.artwork,
					{ width: toMM(trim.width), height: toMM(trim.height) },
					'published artwork against the produced trim box'
				);
				assertSize(
					info.media,
					{ width: toMM(media.width), height: toMM(media.height) },
					'published media against the produced media box'
				);
			}
		}
	];
}
