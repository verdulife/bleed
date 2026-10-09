/**
 * Verification cases for defect D2 ("silent failure: blank A4 instead of an error").
 *
 * `generatePDF` used to swallow every per-file failure, save the (often empty) document
 * with pdf-lib's default `addDefaultPage: true` and publish the resulting blank A4 with no
 * message at all. The cases below drive the real `generatePDF()` and assert the contract
 * that replaces it:
 *
 *   - failures are collected in the `generationErrors` store and name the affected files,
 *   - `save({ addDefaultPage: false })` never adds a page on its own,
 *   - when files were provided but the document has zero pages, nothing is published,
 *   - `alert` is not part of the generation path any more.
 *
 * The module under test is browser code (`Blob`/`URL.createObjectURL`, `alert`), so the
 * doubles are installed *before* the dynamic import below. `alert` is wrapped rather than
 * replaced because `file-ids.ts` installs the primary double and a sibling module
 * (`pdf-blank-pages.ts`) wraps it in turn; replacing it would silence their recorders.
 */
import { get } from 'svelte/store';
import type { UserFile } from '@/lib/types';
import { CROPLINE, FILE_TYPE, toMM } from '@/lib/constants';
import { PDFDocument } from 'pdf-lib';
import type { VerifyCase } from './harness';
import { assert, assertArrayEqual, assertEqual, buildPaintedPdfFixture } from './harness';

// --- browser API test doubles -------------------------------------------------

/**
 * Bun has no usable `blob:` URL support for this purpose, and the point of the cases is to
 * observe *whether* a preview was published, so `URL.createObjectURL` is replaced by a
 * recorder that returns a synthetic id. A missing double makes `generatePDF` publish
 * silently, which is exactly the defect.
 */
const createdObjectUrls: Blob[] = [];

(URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = (blob: Blob) => {
	createdObjectUrls.push(blob);
	return `blob:verify/${createdObjectUrls.length}`;
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

/** `userFiles`/`bleedSettings`/`generationErrors` live in `@/lib/stores`. */
async function loadStores(): Promise<StoresModule> {
	return import('@/lib/stores');
}

// --- fixtures & settings ------------------------------------------------------

/** The document size the user configured; the source fixture uses the same size. */
const DOCUMENT_WIDTH_MM = 100;
const DOCUMENT_HEIGHT_MM = 150;

/** See `pdf-blank-pages.ts`: the one bleed size the current box math is exact for. */
const BLEED_SIZE_MM = CROPLINE.SIZE - CROPLINE.OVERLAY;

/** Not a PDF: `PDFDocument.load` rejects it, so `fileHandler[FILE_TYPE.PDF]` throws. */
const GARBAGE_PDF = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]).buffer;

function makeUserFile(fileName: string, fileBuffer: ArrayBuffer, id: number): UserFile {
	return { fileType: FILE_TYPE.PDF, fileBuffer, fileName, id };
}

function makeSettings() {
	return {
		document: { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM },
		fit: 1 as const,
		autoRotate: 1 as const,
		cropMarksAndBleed: 1 as const,
		bleedSize: BLEED_SIZE_MM,
		mirrorBleed: 0 as const
	};
}

/** Records `console.error` calls instead of printing the expected failures. */
const consoleErrors: unknown[][] = [];

/**
 * Puts the stores in the state the UI would have and runs the real `generatePDF()`. The
 * per-file failures are expected, so `console.error` is captured (and restored) to keep the
 * runner output readable; case 1 asserts the technical detail was still logged.
 */
async function runGeneration(files: UserFile[]) {
	const stores = await loadStores();
	stores.userFiles.set(files);
	stores.bleedSettings.set(makeSettings());
	stores.previewBlobUri.set('');
	createdObjectUrls.length = 0;
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

async function generationErrorsOf(): Promise<string[]> {
	const { generationErrors } = await loadStores();
	return get(generationErrors);
}

async function pageCountOf(blob: Blob): Promise<number> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const document = await PDFDocument.load(bytes);
	return document.getPageCount();
}

/** Guards the "no extra default page" assertion: the published page is the artwork, not A4. */
async function firstPageWidthMM(blob: Blob): Promise<number> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const document = await PDFDocument.load(bytes);
	return toMM(document.getPage(0).getMediaBox().width);
}

// --- cases --------------------------------------------------------------------

export function getPdfErrorCases(): VerifyCase[] {
	return [
		{
			name: 'pdf-errors: when every file fails no blank A4 is published and every failure is reported',
			run: async () => {
				const failing = [
					makeUserFile('poster.pdf', GARBAGE_PDF, 1),
					makeUserFile('flyer.pdf', GARBAGE_PDF, 2)
				];

				await runGeneration(failing);

				// Behavioural first: on the unfixed code this fails because the blank A4 is
				// published, which is the defect itself.
				assertEqual(
					createdObjectUrls.length,
					0,
					'no blob may be published when nothing could be processed'
				);
				assertEqual(
					alertMessages.length,
					0,
					`the generation must not alert, got "${alertMessages.join(' | ')}"`
				);
				assertEqual(
					consoleErrors.length,
					failing.length,
					'the technical detail must still be logged once per failing file'
				);

				const errors = await generationErrorsOf();
				assertArrayEqual(
					errors,
					[
						'Could not process "poster.pdf"',
						'Could not process "flyer.pdf"',
						'No pages were generated'
					],
					'the error list must name every failing file and report the empty document'
				);
			}
		},
		{
			name: 'pdf-errors: a mixed run publishes the good pages and only reports the failing file',
			run: async () => {
				const valid = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);
				const sourcePageCount = (await PDFDocument.load(new Uint8Array(valid))).getPageCount();

				await runGeneration([
					makeUserFile('good.pdf', valid, 1),
					makeUserFile('bad.pdf', GARBAGE_PDF, 2)
				]);

				assertEqual(createdObjectUrls.length, 1, 'the valid file must still be published');
				assertEqual(
					await pageCountOf(createdObjectUrls[0]),
					sourcePageCount,
					'the output must have exactly the pages of the valid source, no extra default page'
				);
				assert(
					Math.abs((await firstPageWidthMM(createdObjectUrls[0])) - (DOCUMENT_WIDTH_MM + 2 * CROPLINE.DISTANCE)) <
						1e-6,
					'the published document must contain the generated artwork page, not a default A4 page'
				);

				assertArrayEqual(
					await generationErrorsOf(),
					['Could not process "bad.pdf"'],
					'the error list must contain exactly the failing file'
				);
			}
		},
		{
			name: 'pdf-errors: a clean run publishes the blob and reports no errors',
			run: async () => {
				const valid = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);

				await runGeneration([makeUserFile('good.pdf', valid, 1)]);

				assertEqual(createdObjectUrls.length, 1, 'a clean run must publish exactly one preview');
				assertArrayEqual(await generationErrorsOf(), [], 'a clean run must not report any error');
			}
		},
		{
			name: 'pdf-errors: errors from one run do not survive into the next generation',
			run: async () => {
				await runGeneration([makeUserFile('bad.pdf', GARBAGE_PDF, 1)]);
				assert(
					(await generationErrorsOf()).length > 0,
					'the failing run must populate the error list in the first place'
				);

				const valid = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);
				await runGeneration([makeUserFile('good.pdf', valid, 2)]);

				assertArrayEqual(
					await generationErrorsOf(),
					[],
					'the next generation must start from an empty error list'
				);
				assertEqual(createdObjectUrls.length, 1, 'the second run must publish its own output');
			}
		}
	];
}
