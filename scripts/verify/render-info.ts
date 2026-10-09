/**
 * Verification cases for B1 ("show the sizes that were actually produced") and T3 ("the
 * output sizes become a full-width bottom bar showing four values").
 *
 * The user wants to see, after a render, the document size **without** crop marks, the size
 * **with** crop marks, the bleed amount that was used and the page count - it matters most
 * when one axis is empty and the app derives it from the artwork aspect ratio, because today
 * that decision is invisible. The hard constraint is that those numbers must be read back
 * from the produced PDF (`page.getMediaBox()`, `page.getTrimBox()`, `page.getBleedBox()` on
 * the generated document), never recomputed in the UI from the same formula that drives
 * generation.
 *
 * T3 changed what the bar shows. The old panel listed the media box, the growth added by the
 * crop marks and the **bleed-box size**; the bar shows the trim box (the "without crop
 * marks" value), the media box (the "with crop marks" value), the bleed **amount** per side
 * and the page count. The amount is `RenderInfo.bleedAmountMM`, derived from the produced
 * document as `(bleedBox - trimBox) / 2` (the BleedBox is the TrimBox grown by the amount on
 * every side), never from the settings. It is 0 in `none` (v2 decision 3 declares no bleed
 * whatever the configured size says) and the configured size in `mirror`/`natural`. The
 * cases below assert it for a `none` run with a non-default configured size - the shape that
 * discriminates a read-back from a settings copy, because the settings say 2 mm and the file
 * must say 0 - for a mirror fill and for a natural fill with a non-default bleed, and once
 * against the boxes of the produced file. The bleed **box** stays in `RenderInfo` as the
 * source the amount is derived from, and is still asserted here even though the bar no longer
 * shows it.
 *
 * The cases drive the real `generatePDF()` and inspect the `renderInfo` store plus the
 * published blob that `generatePDF` captured with `URL.createObjectURL` (doubled below,
 * following `pdf-errors.ts`). The last case reloads the produced bytes and compares them
 * against the published numbers, which is what proves the panel is not deriving anything.
 */
import { get } from 'svelte/store';
import type { BleedMode, BleedSettings, BoxSize, RenderInfo, UserFile } from '@/lib/types';
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

/**
 * A fixture bleed, deliberately different from the store default (3 mm since T2) and passed
 * explicitly by `makeSettings`, so these cases cannot follow a change of that default. It is
 * **below** the crop-mark distance, so the page grows for the marks and not for the bleed,
 * and it is used only by runs that declare no bleed: this is the discriminating shape for
 * `bleedAmountMM`, because the settings say 2 mm while the produced file must say 0. A
 * mirror or natural run needs a value that reaches the geometry, which is what
 * `FILL_BLEED_SIZE_MM` is for.
 */
const BLEED_SIZE_MM = 2;

/**
 * The bleed of the fill-mode cases: not the store default, and **above** the crop-mark
 * distance, so the page grows to `art + 2 x bleed` (v2 decision 2) and the expected media
 * box cannot be confused with the mark-only one. The margin then equals the bleed, which
 * `expectedMediaBoxSize` is told explicitly instead of deriving it.
 */
const FILL_BLEED_SIZE_MM = CROPLINE.DISTANCE + 1;

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
	bleedMode?: BleedMode;
	bleedSize?: number;
};

function makeSettings(overrides: SettingsOverrides = {}): BleedSettings {
	return {
		document: overrides.document ?? { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM },
		fit: 1,
		autoRotate: 1,
		cropMarks: overrides.cropMarks ?? 1,
		bleedSize: overrides.bleedSize ?? BLEED_SIZE_MM,
		bleedMode: overrides.bleedMode ?? 'none'
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

/**
 * The bleed **amount** per side, in millimetres: how far the produced BleedBox extends past
 * the produced TrimBox. Asserted on its own because it is the value the bar shows, and
 * because in `none` mode the bleed box is textually the trim box, so the box assertions
 * alone would no longer prove that the amount was read back.
 */
function assertAmount(actual: number, expected: number, label: string) {
	assert(
		Math.abs(actual - expected) < TOLERANCE_MM,
		`${label}: expected ${expected} mm, got ${actual} mm`
	);
}

/** The media box: the artwork plus `marginMM` on every side (crop marks on). */
function expectedMediaBoxSize(artwork: BoxSize, marginMM: number): BoxSize {
	return {
		width: artwork.width + 2 * marginMM,
		height: artwork.height + 2 * marginMM
	};
}

/**
 * The BleedBox of a run, in millimetres: the TrimBox grown by `declaredMM` on every side.
 *
 * v2 decision 3 changed this expectation for `none`: the box used to be the media box inset
 * by `CROPLINE.DISTANCE - BLEED_SIZE_MM`, that is `art + 2 x BLEED_SIZE_MM`, because the
 * pre-v2 contract declared a bleed in `none` mode too. `none` now declares no bleed, so the
 * produced BleedBox equals the TrimBox - with `declaredMM = 0` this helper is textually
 * identical to `documentSize()`. That is exactly why the amount is asserted next to it: the
 * box alone would have no discriminating power left in `none`.
 */
function expectedBleedBoxSize(declaredMM: number): BoxSize {
	return {
		width: DOCUMENT_WIDTH_MM + 2 * declaredMM,
		height: DOCUMENT_HEIGHT_MM + 2 * declaredMM
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
				assertSize(
					info.media,
					expectedMediaBoxSize(documentSize(), CROPLINE.DISTANCE),
					'media box (with crop marks)'
				);
				assertSize(info.bleed, expectedBleedBoxSize(0), 'bleed box in none mode');
				// Decision 3 declares no bleed, so this run must report an amount of 0 even
				// though the settings ask for `BLEED_SIZE_MM`. An implementation that copied
				// the configured size into the panel would pass every box assertion above and
				// fail only here, which is the discriminating assertion T3 added.
				assertAmount(info.bleedAmountMM, 0, 'bleed amount in none mode');
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
					expectedMediaBoxSize(artworkSize, CROPLINE.DISTANCE),
					'media box derived from the artwork aspect ratio'
				);
			}
		},
		{
			// New in T3: a mirror fill must report the configured bleed as the amount per side.
			// The bleed box never reaches the bars, so the amount is the only published value
			// that carries the fill; asserting it keeps decision 2's geometry observable
			// through the panel's own contract.
			name: 'render-info: a mirror fill reports the configured bleed as an amount per side',
			run: async () => {
				const fixture = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);
				await runGeneration(
					[makeUserFile('poster.pdf', fixture, 1)],
					makeSettings({ bleedMode: 'mirror', bleedSize: FILL_BLEED_SIZE_MM })
				);

				const info = await renderInfoOf();
				assert(info !== null, 'a successful run must publish render info');

				assertSize(info.artwork, documentSize(), 'artwork stays the document in a mirror fill');
				// The bleed is larger than the crop-mark distance, so the margin equals the
				// bleed (v2 decision 2) and the page grows to `art + 2 x bleed`.
				assertSize(
					info.media,
					expectedMediaBoxSize(documentSize(), FILL_BLEED_SIZE_MM),
					'media box of a mirror fill'
				);
				assertSize(
					info.bleed,
					expectedBleedBoxSize(FILL_BLEED_SIZE_MM),
					'bleed box of a mirror fill'
				);
				assertAmount(
					info.bleedAmountMM,
					FILL_BLEED_SIZE_MM,
					'bleed amount of a mirror fill'
				);
			}
		},
		{
			// New in T3: the same amount contract for `natural`, which fits a different box
			// (`artworkTargetBoxForBleedMode` resolves to `bleed`) and always covers. The
			// amount is a property of the produced file, so it must not depend on which box
			// the artwork was fitted into.
			name: 'render-info: a natural fill reports the configured bleed as an amount per side',
			run: async () => {
				const fixture = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);
				await runGeneration(
					[makeUserFile('poster.pdf', fixture, 1)],
					makeSettings({ bleedMode: 'natural', bleedSize: FILL_BLEED_SIZE_MM })
				);

				const info = await renderInfoOf();
				assert(info !== null, 'a successful run must publish render info');

				assertSize(
					info.artwork,
					documentSize(),
					'artwork stays the document in a natural fill'
				);
				assertSize(
					info.media,
					expectedMediaBoxSize(documentSize(), FILL_BLEED_SIZE_MM),
					'media box of a natural fill'
				);
				assertSize(
					info.bleed,
					expectedBleedBoxSize(FILL_BLEED_SIZE_MM),
					'bleed box of a natural fill'
				);
				assertAmount(
					info.bleedAmountMM,
					FILL_BLEED_SIZE_MM,
					'bleed amount of a natural fill'
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
				// New in T3: with no marks and no bleed fill the page is the document, so the
				// amount must be 0 as well - the row the bar shows instead of the box size.
				assertAmount(info.bleedAmountMM, 0, 'bleed amount without crop marks');
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
			// The fixture moved from `none` to `mirror` in T3, deliberately: with `none` the
			// amount read back is 0, so the "published numbers are the file's numbers" property
			// would not be exercised for the value the bar now shows. `mirror` with a
			// non-default bleed makes all four published values non-trivial.
			name: 'render-info: the published numbers match the produced PDF instead of being recomputed',
			run: async () => {
				const fixture = await buildPaintedPdfFixture(DOCUMENT_WIDTH_MM, DOCUMENT_HEIGHT_MM);
				await runGeneration(
					[makeUserFile('poster.pdf', fixture, 1)],
					makeSettings({ bleedMode: 'mirror', bleedSize: FILL_BLEED_SIZE_MM })
				);

				assertEqual(publishedBlobs.length, 1, 'the run must publish its produced file');
				const info = await renderInfoOf();
				assert(info !== null, 'a successful run must publish render info');

				// Independent read: the boxes of the serialized output, reloaded with pdf-lib.
				const page = await loadProducedPage(publishedBlobs[0]);
				const trim = page.getTrimBox();
				const media = page.getMediaBox();
				const bleed = page.getBleedBox();

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
				assertSize(
					info.bleed,
					{ width: toMM(bleed.width), height: toMM(bleed.height) },
					'published bleed box against the produced bleed box'
				);
				// The amount is recomputed here from the boxes the file carries, not from the
				// settings: this is the assertion that the published amount is a read-back.
				assertAmount(
					info.bleedAmountMM,
					toMM(bleed.width - trim.width) / 2,
					'published bleed amount against the produced boxes'
				);
			}
		}
	];
}
