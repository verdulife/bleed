/**
 * Verification cases for the production-only crash of an embedded PDF page.
 *
 * `file-helpers.ts` chose between `page.drawPage()` and `page.drawImage()` by sniffing the
 * embeddable's constructor name (`embedFile.constructor.name.toLowerCase().includes('page')`),
 * and `settings-helpers.ts` sniffed it a second time for the mirrored copies. A name only
 * survives while the bundle is unminified: Vite/esbuild renames the class in the deployed
 * bundle, so the sniff suddenly answers "not a page", a `PDFEmbeddedPage` is handed to
 * `drawImage`, and pdf-lib throws
 * `` `image` must be of type `PDFImage`, but was actually of type `NaN` `` - `NaN` because
 * pdf-lib's message-only `getType` falls into its `isNaN(value)` branch for any non-primitive.
 * That pair is the user's "works on localhost, fails on Vercel".
 *
 * The harness runs the unminified sources, so it cannot observe the minifier itself. Cases 1-3
 * reproduce its *consequence* by renaming the pdf-lib classes while a case runs
 * (`withMangledClassNames`); case 4 guards the *pattern* at source level. Neither is a minified
 * end-to-end build: only the deployed bundle can confirm the real thing. The fix itself is
 * `instanceof PDFEmbeddedPage`, the same mechanism pdf-lib uses internally (`isType` falls
 * through to `instanceof`; only the error *message* uses a name).
 *
 * The cases drive the real `fileHandler[FILE_TYPE.*]` path over pdf-lib fixtures and save the
 * result, the way `pdf-blank-pages.ts` does. Only `bleedSettings` is set: `generatePDF` is not
 * part of the contract under test.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { CROPLINE, FILE_TYPE } from '@/lib/constants';
import type { BleedMode } from '@/lib/types';
import { PDFDict, PDFDocument, PDFEmbeddedPage, PDFImage, PDFName, PDFStream } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { VerifyCase } from './harness';
import { assert, assertArrayEqual, assertEqual, buildPaintedPdfFixture } from './harness';

// --- modules under test (loaded dynamically, like the other modules) ----------

type FileHelpersModule = typeof import('@/lib/file-helpers');
type StoresModule = typeof import('@/lib/stores');

let loadedHelpers: Promise<FileHelpersModule> | null = null;

function loadFileHelpers(): Promise<FileHelpersModule> {
	loadedHelpers ??= import('@/lib/file-helpers');
	return loadedHelpers;
}

async function loadStores(): Promise<StoresModule> {
	return import('@/lib/stores');
}

// --- fixtures & settings ------------------------------------------------------

/** The size the user configured; the artwork fixture uses the same size. */
const DOCUMENT_WIDTH_MM = 100;
const DOCUMENT_HEIGHT_MM = 150;

/**
 * The bleed of the mirror case. It sits below the mark distance, like the fixture of the
 * other modules, but it carries no correctness of its own: the v2 box math is exact for every
 * bleed size. Here it only has to be a real bleed so the mirror branch has a bleed box to
 * cover.
 */
const BLEED_SIZE_MM = CROPLINE.SIZE - CROPLINE.OVERLAY;

/** The mirrored copies `drawMirrorBleed` draws around the artwork: the eight sides. */
const MIRROR_COPY_COUNT = 8;

/** Every draw placed on a `mirror` page: the artwork itself plus its mirrored copies. */
const DRAWS_WITH_MIRROR_BLEED = 1 + MIRROR_COPY_COUNT;

/** A small landscape image, so the image branch works on a real aspect ratio. */
const PNG_WIDTH = 4;
const PNG_HEIGHT = 3;

async function setSettings(cropMarks: 0 | 1, bleedMode: BleedMode) {
	const { bleedSettings } = await loadStores();
	bleedSettings.set({
		document: { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM },
		fit: 1,
		autoRotate: 1,
		cropMarks,
		bleedSize: BLEED_SIZE_MM,
		bleedMode
	});
}

/** Runs the real per-file handler, as `generatePDF` does per file. Callers pass a `FILE_TYPE`. */
async function runHandler(fileType: string, fixture: ArrayBuffer): Promise<PDFDocument> {
	const { fileHandler } = await loadFileHelpers();
	const output = await PDFDocument.create();
	await fileHandler[fileType](output, fixture);
	return output;
}

/**
 * Runs the real handler and returns the **reloaded** produced file, so every assertion is made
 * against what the handler wrote instead of against intermediate state. It has to be the saved
 * document: pdf-lib assigns an embedded page or image to its reference while saving (`flush`),
 * so the XObject resources cannot be resolved before that.
 */
async function runHandlerAndReload(
	fileType: string,
	fixture: ArrayBuffer
): Promise<PDFDocument> {
	const produced = await runHandler(fileType, fixture);
	const bytes = await produced.save({ addDefaultPage: false });
	assert(bytes.length > 0, 'the saved document must not be empty');
	return PDFDocument.load(bytes);
}

// --- PNG fixture --------------------------------------------------------------

/**
 * A minimal valid truecolour PNG, built with `node:zlib` instead of committed bytes: the
 * harness holds no binary fixtures, and pdf-lib's decoder only accepts a real PNG, so
 * `fileHandler[FILE_TYPE.PNG]` can only be exercised with bytes it accepts.
 * The CRC32 polynomial is the one the PNG format mandates.
 */
function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

/** One PNG chunk: length, type, data, and a CRC over type + data. */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const chunk = new Uint8Array(12 + data.length);
	const view = new DataView(chunk.buffer);
	view.setUint32(0, data.length);
	for (let index = 0; index < 4; index += 1) chunk[4 + index] = type.charCodeAt(index);
	chunk.set(data, 8);
	view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
	return chunk;
}

/**
 * `width` x `height` pixels of black, one filter byte (0 = none) per scanline: that prefix is
 * what makes the deflated IDAT stream decodable by pdf-lib's PNG decoder.
 */
function buildPngFixture(width: number, height: number): ArrayBuffer {
	const header = new Uint8Array(13);
	const headerView = new DataView(header.buffer);
	headerView.setUint32(0, width);
	headerView.setUint32(4, height);
	header[8] = 8; // bit depth
	header[9] = 2; // colour type: truecolour

	const scanlines = new Uint8Array(height * (1 + width * 3));
	const parts = [
		new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk('IHDR', header),
		pngChunk('IDAT', new Uint8Array(deflateSync(scanlines))),
		pngChunk('IEND', new Uint8Array())
	];

	const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		png.set(part, offset);
		offset += part.length;
	}
	return png.buffer;
}

// --- the minifier double ------------------------------------------------------

/**
 * The name a minifier gives a renamed class in the deployed bundle: a short identifier that
 * no longer contains "page". Nothing about it is special, which is the whole point.
 */
const MINIFIED_CLASS_NAME = 'n';

/** The minifier renames both embeddable classes, so both get the treatment. */
const RENAMED_CLASSES = [PDFEmbeddedPage, PDFImage];

/**
 * Renames the pdf-lib classes for the duration of `run`, the way the production minifier does,
 * and restores them afterwards even when the case throws.
 *
 * The rename goes on the prototype, which is exactly what a renamed class amounts to: every
 * instance keeps its `instanceof` relationship (what pdf-lib's own `isType` and the fix rely
 * on) while `constructor.name` stops reporting the class's name. Restoring through the saved
 * property descriptors keeps the original attributes of `constructor`, not just its value.
 */
async function withMangledClassNames(run: () => Promise<void>): Promise<void> {
	const originals = RENAMED_CLASSES.map((renamed) =>
		Object.getOwnPropertyDescriptor(renamed.prototype, 'constructor')
	);

	RENAMED_CLASSES.forEach((renamed, index) => {
		assert(
			originals[index] !== undefined,
			`${renamed.name}: the class-name double needs an own prototype.constructor descriptor`
		);
		Object.defineProperty(renamed.prototype, 'constructor', {
			value: { name: MINIFIED_CLASS_NAME },
			configurable: true,
			writable: true
		});
	});

	// Self-check of the double: with the rename in place the name-based sniff this defect came
	// from must answer "not a page", otherwise the cases below would prove nothing.
	assert(
		!PDFEmbeddedPage.prototype.constructor.name.toLowerCase().includes('page'),
		'the class-name double must hide "page" from a name-based type check'
	);

	try {
		await run();
	} finally {
		RENAMED_CLASSES.forEach((renamed, index) => {
			const original = originals[index];
			if (original) Object.defineProperty(renamed.prototype, 'constructor', original);
		});
	}
}

// --- what the produced page actually got --------------------------------------

/**
 * The XObject subtypes the drawing calls registered on `page`: an embedded page is drawn as a
 * form XObject (`/Form`) and an embedded image as an image XObject (`/Image`). That is the
 * observable difference between the two branches of the discriminant, read back from the
 * produced document instead of from the branch that was taken. pdf-lib gives every draw its
 * own resource key (`PDFDict.uniqueKey`), so the list is one entry per draw.
 */
function xObjectSubtypes(page: PDFPage): string[] {
	const xObjects = page.node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict);
	if (!xObjects) return [];

	return xObjects
		.keys()
		.map((key) => String(xObjects.lookup(key, PDFStream).dict.get(PDFName.of('Subtype'))));
}

// --- the source-level guard ---------------------------------------------------

/** Every file under `src/`, resolved from this script so the guard does not depend on the cwd. */
function sourceFiles(): string[] {
	const root = fileURLToPath(new URL('../../src/', import.meta.url));

	const walk = (directory: string): string[] =>
		readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
			const path = join(directory, entry.name);
			return entry.isDirectory() ? walk(path) : [path];
		});

	return walk(root);
}

// --- cases --------------------------------------------------------------------

export function getMinificationSafetyCases(): VerifyCase[] {
	return [
		{
			// This is the case that reproduces the production bug: on the name-sniffing code it
			// fails with pdf-lib's TypeError, exactly the one the user's console showed.
			name: 'minification-safety: an embedded page still draws as a page when its class name is mangled',
			run: () =>
				withMangledClassNames(async () => {
					await setSettings(1, 'none');
					const fixture = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);

					const output = await runHandlerAndReload(FILE_TYPE.PDF, fixture);

					assertEqual(output.getPageCount(), 1, 'the source page must be preserved');
					assertArrayEqual(
						xObjectSubtypes(output.getPage(0)),
						['/Form'],
						'the embedded page must be drawn as a form XObject, not as an image'
					);
				})
		},
		{
			name: 'minification-safety: an embedded image with a mangled class name still draws as an image',
			run: () =>
				withMangledClassNames(async () => {
					await setSettings(0, 'none');
					const fixture = buildPngFixture(PNG_WIDTH, PNG_HEIGHT);

					const output = await runHandlerAndReload(FILE_TYPE.PNG, fixture);

					assertEqual(output.getPageCount(), 1, 'the image must produce one output page');
					assertArrayEqual(
						xObjectSubtypes(output.getPage(0)),
						['/Image'],
						'the embedded image must be drawn as an image XObject, not as a page'
					);
				})
		},
		{
			// Covers `settings-helpers.ts`: the mirrored copies went through a second name sniff of
			// their own, so a fix that only covered `file-helpers.ts` would still throw here.
			name: 'minification-safety: mirror bleed over a mangled embedded page draws every copy',
			run: () =>
				withMangledClassNames(async () => {
					await setSettings(1, 'mirror');
					const fixture = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);

					const output = await runHandlerAndReload(FILE_TYPE.PDF, fixture);

					assertEqual(output.getPageCount(), 1, 'the source page must be preserved');
					const subtypes = xObjectSubtypes(output.getPage(0));
					assertEqual(
						subtypes.length,
						DRAWS_WITH_MIRROR_BLEED,
						'the artwork and its eight mirrored copies must all be drawn'
					);
					assert(
						subtypes.every((subtype) => subtype === '/Form'),
						`every mirrored copy must be drawn as a form XObject, got [${subtypes.join(', ')}]`
					);
				})
		},
		{
			// Honest scope: this is a source-level guard against a whole class of minification bug
			// (any decision made from a class name), not a behavioural check. The harness cannot run
			// the code through the minifier, so the deployed bundle remains the only place where the
			// real rename is observed; what this case can do is keep the pattern from coming back.
			name: 'minification-safety: no source file decides anything from a class name',
			run: () => {
				const files = sourceFiles();
				assert(
					files.length > 0,
					'the guard must walk a non-empty src/ tree, otherwise it would always pass'
				);

				const offenders = files.filter((file) =>
					readFileSync(file, 'utf8').includes('constructor.name')
				);

				assertEqual(
					offenders.length,
					0,
					`no file under src/ may sniff a class name (class names are mangled by the ` +
						`production minifier), offenders: [${offenders.join(', ')}]`
				);
			}
		}
	];
}
