/**
 * Verification cases for the bleed contract, v2 ("the bleed modes follow the user's rules").
 *
 * The predecessor of this suite (B3, "the bleed fill becomes selectable") encoded the first
 * bleed implementation: the page margin was a single "does the page need room?" flag
 * (`needsPageMargin`), it was always 2 x `CROPLINE.DISTANCE`, and every mode - including
 * `none` - declared a BleedBox of `art + 2 * bleedSize`. The user has since specified the
 * real rules, so this suite now asserts the acceptance matrix below, row by row.
 *
 *   | Crop marks | Mode      | Page (media box)        | Trim box | Declared bleed box | Artwork |
 *   | ---------- | --------- | ----------------------- | -------- | ------------------ | ------- |
 *   | off        | `none`    | art                     | art      | art                | plain   |
 *   | off        | `mirror`  | art + bleed             | art      | = page             | mirror  |
 *   | off        | `natural` | art + bleed             | art      | = page             | covers  |
 *   | on         | `none`    | art + max(6 mm, bleed)  | art      | art (none declared)| clipped |
 *   | on         | `mirror`  | art + max(6 mm, bleed)  | art      | art + bleed        | mirror  |
 *   | on         | `natural` | art + max(6 mm, bleed)  | art      | art + bleed        | covers  |
 *
 * The three confirmed decisions behind it:
 *
 *   1. `natural` always covers the bleed area, whatever `Crop to fit` says (with "contain"
 *      the artwork would leave the white that `natural` exists to prevent); `Crop to fit`
 *      keeps governing `none` and `mirror`. `usesCoverFit` carries this.
 *   2. A bleed larger than the mark distance **grows the page**: `max(6 mm, bleed)` per
 *      side. The pre-v2 code silently clamped the bleed box to the media box, so a 10 mm
 *      bleed could not be filled at all.
 *   3. `none` declares **no** bleed: the BleedBox equals the TrimBox, so an unused bleed
 *      size is not printed into the file.
 *
 * Case 1 covers the pure decisions (`bleed-mode.ts`) for every row. The remaining cases
 * drive the real `generatePDF()` and read the boxes back from the produced file, following
 * `pdf-errors.ts` / `render-info.ts` (`URL.createObjectURL` is wrapped, not replaced, so the
 * published blob can be captured and re-opened independently). Cases 2-5 keep their
 * pre-v2 names so a reviewer can see which expectation moved and why; each moved
 * expectation carries a comment naming what it used to encode.
 *
 * Limitation: the harness cannot read the drawing out of the PDF content stream, so
 * "the mirror copies cover the bleed band", "the artwork is clipped to the trim box in
 * `none`" and "the crop marks sit on the trim line" are covered by the pure decisions plus
 * the produced geometry, not by inspecting the rendering. The visual pass is the user's.
 */
import { get } from 'svelte/store';
import type { BleedMode, BleedSettings, BoxSize, UserFile } from '@/lib/types';
import { CROPLINE, FILE_TYPE, toMM } from '@/lib/constants';
import { PDFDocument } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { PageBox, PageBoxes } from '@/lib/page-boxes';
import type { VerifyCase } from './harness';
import { assert, assertArrayEqual, assertEqual, buildPaintedPdfFixture } from './harness';
import {
	artworkTargetBoxForBleedMode,
	clipExtendsToBleed,
	declaredBleedMM,
	drawsMirrorBleed,
	pageMarginMM,
	usesCoverFit
} from '@/lib/bleed-mode';

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
 * A bleed **below** the mark distance, so the page grows for the marks rather than for the
 * bleed. Its value (`CROPLINE.SIZE - CROPLINE.OVERLAY` = 3 mm) is the historical fixed point
 * of the old box math, which the predecessor suite carried as `NON_DEFAULT_BLEED_SIZE_MM`.
 * T2 made 3 mm the store default too, but `makeSettings` always passes it explicitly, so
 * these cases do not follow the store: a further move of the default cannot relabel any
 * expectation here.
 */
const SMALL_BLEED_MM = CROPLINE.SIZE - CROPLINE.OVERLAY;

/**
 * A bleed **above** the mark distance: decision 2's case. The page must grow to
 * `art + 2 * bleed` and the bleed box must reach the media box, where the pre-v2 code
 * clamped the bleed box to the media box and could not fill the requested bleed at all.
 */
const LARGE_BLEED_MM = CROPLINE.DISTANCE + CROPLINE.SIZE;

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
		bleedSize: overrides.bleedSize ?? SMALL_BLEED_MM,
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

// --- the acceptance matrix, written out per row -------------------------------

/**
 * One row of the confirmed table. The values are written out here instead of being derived
 * from `bleed-mode.ts`, so a regression in the module cannot make its own test pass.
 */
type AcceptanceRow = {
	cropMarks: 0 | 1;
	mode: BleedMode;
	/** Per side, from the media edge to the trim line. */
	marginMM: number;
	/** How far the BleedBox extends past the TrimBox, per side. */
	declaredBleedMM: number;
	/** Whether the artwork clip is the bleed box instead of the trim box. */
	clipToBleed: boolean;
	/** `usesCoverFit(0, mode)`: `natural` overrides `Crop to fit` (decision 1). */
	coverWithContainFit: boolean;
};

/** The table of the module header, for one bleed size. */
function acceptanceTable(bleedMM: number): AcceptanceRow[] {
	const marginWithMarks = Math.max(CROPLINE.DISTANCE, bleedMM);

	return [
		{
			cropMarks: 0,
			mode: 'none',
			marginMM: 0,
			declaredBleedMM: 0,
			clipToBleed: false,
			coverWithContainFit: false
		},
		{
			cropMarks: 0,
			mode: 'mirror',
			marginMM: bleedMM,
			declaredBleedMM: bleedMM,
			clipToBleed: true,
			coverWithContainFit: false
		},
		{
			cropMarks: 0,
			mode: 'natural',
			marginMM: bleedMM,
			declaredBleedMM: bleedMM,
			clipToBleed: true,
			coverWithContainFit: true
		},
		{
			cropMarks: 1,
			mode: 'none',
			marginMM: marginWithMarks,
			declaredBleedMM: 0,
			clipToBleed: false,
			coverWithContainFit: false
		},
		{
			cropMarks: 1,
			mode: 'mirror',
			marginMM: marginWithMarks,
			declaredBleedMM: bleedMM,
			clipToBleed: true,
			coverWithContainFit: false
		},
		{
			cropMarks: 1,
			mode: 'natural',
			marginMM: marginWithMarks,
			declaredBleedMM: bleedMM,
			clipToBleed: true,
			coverWithContainFit: true
		}
	];
}

/** The single row for a crop-marks/mode combination, as the row cases use it. */
function rowFor(cropMarks: 0 | 1, mode: BleedMode, bleedMM: number): AcceptanceRow {
	const row = acceptanceTable(bleedMM).find(
		(candidate) => candidate.cropMarks === cropMarks && candidate.mode === mode
	);
	assert(row !== undefined, `the acceptance table must have a row for ${cropMarks}/${mode}`);
	return row;
}

function rowLabel(row: AcceptanceRow): string {
	return `crop marks ${row.cropMarks === 1 ? 'on' : 'off'} + ${row.mode}`;
}

/** The boxes the table requires for one row, all in millimetres. */
function expectedBoxes(row: AcceptanceRow): PageBoxes {
	const media: PageBox = {
		x: 0,
		y: 0,
		width: DOCUMENT_WIDTH_MM + 2 * row.marginMM,
		height: DOCUMENT_HEIGHT_MM + 2 * row.marginMM
	};
	const bleedInsetMM = Math.max(0, row.marginMM - row.declaredBleedMM);

	return {
		media,
		trim: {
			x: row.marginMM,
			y: row.marginMM,
			width: DOCUMENT_WIDTH_MM,
			height: DOCUMENT_HEIGHT_MM
		},
		bleed: {
			x: bleedInsetMM,
			y: bleedInsetMM,
			width: media.width - 2 * bleedInsetMM,
			height: media.height - 2 * bleedInsetMM
		}
	};
}

// --- assertions ---------------------------------------------------------------

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

/** The artwork size the fixture and the settings share. */
function artworkSize(): BoxSize {
	return { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM };
}

/**
 * Asserts one row of the table against the file the real pipeline produced: exactly one
 * page, and the three boxes (plus the declared bleed they imply) of that row.
 */
async function assertRowGeometry(row: AcceptanceRow, label: string) {
	assertEqual(publishedBlobs.length, 1, `${label}: the run must publish exactly one file`);
	assertEqual(
		await producedPageCount(publishedBlobs[0]),
		1,
		`${label}: the run must produce exactly one page`
	);

	const page = await loadProducedPage(publishedBlobs[0]);
	const expected = expectedBoxes(row);
	const producedMedia = boxMM(page.getMediaBox());
	const producedTrim = boxMM(page.getTrimBox());
	const producedBleed = boxMM(page.getBleedBox());

	assertBox(producedMedia, expected.media, `${label} media box`);
	assertBox(producedTrim, expected.trim, `${label} trim box`);
	assertBox(producedBleed, expected.bleed, `${label} bleed box`);

	// The declared bleed is what the BleedBox adds around the TrimBox, per side. Asserted
	// separately from the box equality so the meaning of `declaredBleedMM` is pinned:
	// 0 in `none` (decision 3), the bleed amount otherwise.
	assert(
		Math.abs((producedBleed.width - producedTrim.width) / 2 - row.declaredBleedMM) <
			TOLERANCE_MM &&
			Math.abs((producedBleed.height - producedTrim.height) / 2 - row.declaredBleedMM) <
				TOLERANCE_MM,
		`${label}: the declared bleed must be ${row.declaredBleedMM} mm per side, got ` +
			`${(producedBleed.width - producedTrim.width) / 2} x ` +
			`${(producedBleed.height - producedTrim.height) / 2} mm`
	);

	assertArrayEqual(await generationErrorsOf(), [], `${label}: the run must report no error`);
}

// --- cases --------------------------------------------------------------------

export function getBleedModeCases(): VerifyCase[] {
	return [
		{
			name: 'bleed-modes: the mode decides the artwork target box, the mirror fill, the margin, the declared bleed, the clip and the cover fit (pure)',
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

				// This case used to assert `needsPageMargin(cropMarks, mode)`, a single boolean
				// that said the page always grew by 2 x `CROPLINE.DISTANCE`. The confirmed table
				// replaced it with three separate values per row, and every row now has to hold
				// for a bleed below the mark distance and for one above it (decision 2).
				for (const bleedMM of [SMALL_BLEED_MM, LARGE_BLEED_MM]) {
					for (const row of acceptanceTable(bleedMM)) {
						const label = `${rowLabel(row)} at ${bleedMM} mm bleed`;

						assertEqual(
							pageMarginMM(row.cropMarks, row.mode, bleedMM),
							row.marginMM,
							`${label}: the page margin per side`
						);
						// The declared bleed takes no crop-marks argument: the marks only move the trim
						// line, never the amount of bleed the file declares (decision 3).
						assertEqual(
							declaredBleedMM(row.mode, bleedMM),
							row.declaredBleedMM,
							`${label}: the declared bleed`
						);
						assertEqual(
							clipExtendsToBleed(row.mode),
							row.clipToBleed,
							`${label}: whether the clip is the bleed box`
						);

						// Decision 1: `natural` covers even when `Crop to fit` says contain, and
						// `Crop to fit` keeps governing `none` and `mirror`.
						assertEqual(
							usesCoverFit(0, row.mode),
							row.coverWithContainFit,
							`${label}: the cover fit decision with fit = 0 (contain)`
						);
						assertEqual(
							usesCoverFit(1, row.mode),
							true,
							`${label}: the cover fit decision with fit = 1 (cover)`
						);
					}
				}

				// A negative bleed must never shrink the margin below what the marks need, and
				// must never invert a declared box.
				assertEqual(
					pageMarginMM(1, 'none', -SMALL_BLEED_MM),
					CROPLINE.DISTANCE,
					'a negative bleed must leave the crop-mark margin untouched'
				);
				assertEqual(
					pageMarginMM(0, 'mirror', -SMALL_BLEED_MM),
					0,
					'a negative bleed with no marks must be treated as no bleed'
				);
				assertEqual(
					declaredBleedMM('mirror', -SMALL_BLEED_MM),
					0,
					'a negative declared bleed must be clamped to 0'
				);
			}
		},
		{
			name: 'bleed-modes: a mirror fill without crop marks still grows the page and keeps the trim on the artwork',
			run: async () => {
				const row = rowFor(0, 'mirror', SMALL_BLEED_MM);
				await runGeneration(
					makeSettings({ cropMarks: 0, bleedMode: 'mirror', bleedSize: SMALL_BLEED_MM })
				);

				// What this case used to encode: the page grew by 2 x `CROPLINE.DISTANCE`
				// (`needsPageMargin(0, 'mirror') === true`), so the media box was
				// `art + 2 x 6 mm` and the bleed box `art + 2 x bleedSize` inside it. The
				// confirmed margin column changed that: with no crop marks the margin is the
				// **bleed**, not the mark distance, so the media box is `art + 2 x bleed` and
				// the bleed box coincides with it. The case name still holds.
				assertEqual(row.marginMM, SMALL_BLEED_MM, 'no marks means the margin is the bleed');
				await assertRowGeometry(row, 'mirror without crop marks');
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
				const row = rowFor(1, 'none', SMALL_BLEED_MM);
				await runGeneration(
					makeSettings({ cropMarks: 1, bleedMode: 'none', bleedSize: SMALL_BLEED_MM })
				);

				// What this case used to encode: the page grew by 2 x `CROPLINE.DISTANCE`
				// (unchanged, still the margin under the confirmed table) **and** the file
				// declared a bleed box of `art + 2 x bleedSize`. Decision 3 changed the second
				// half: `none` declares no bleed at all, so the produced BleedBox equals the
				// TrimBox and the bleed size never reaches the file.
				assertEqual(row.marginMM, CROPLINE.DISTANCE, 'the marks need the mark margin');
				assertEqual(row.declaredBleedMM, 0, '`none` declares no bleed');
				await assertRowGeometry(row, 'crop marks without a fill');
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
				const row = rowFor(1, 'natural', SMALL_BLEED_MM);
				await runGeneration(
					makeSettings({ cropMarks: 1, bleedMode: 'natural', bleedSize: SMALL_BLEED_MM })
				);

				// The geometry of this row did not move: with crop marks on and a bleed below
				// the mark distance, the margin stays `CROPLINE.DISTANCE` and the declared
				// bleed stays the bleed size. What is new is decision 1, asserted through the
				// pure function above (`usesCoverFit(0, 'natural') === true`) - the artwork is
				// now guaranteed to cover the bleed box even when `Crop to fit` says contain.
				await assertRowGeometry(row, 'natural fill');
				assertEqual(
					artworkTargetBoxForBleedMode('natural'),
					'bleed',
					'the natural run fits the artwork into the bleed box'
				);
				assertEqual(drawsMirrorBleed('natural'), false, 'a natural fill draws no mirror copy');
			}
		},
		{
			name: 'bleed-modes: every row of the acceptance table produces one page with the boxes of the table',
			run: async () => {
				// Replaces the pre-v2 "all three modes produce one page with the trim on the
				// artwork and room for the marks", which covered only the three modes with crop
				// marks on, at one bleed size, and asserted a single shared geometry for all of
				// them. The bleed box is mode-dependent now (`none` declares none), so the
				// sweep walks all six rows at both bleed sizes and asserts each row's own boxes
				// and page count.
				for (const bleedMM of [SMALL_BLEED_MM, LARGE_BLEED_MM]) {
					for (const row of acceptanceTable(bleedMM)) {
						await runGeneration(
							makeSettings({
								cropMarks: row.cropMarks,
								bleedMode: row.mode,
								bleedSize: bleedMM
							})
						);
						await assertRowGeometry(row, `${rowLabel(row)} at ${bleedMM} mm bleed`);
					}
				}
			}
		},
		{
			name: 'bleed-modes: bleedSize shapes the bleed box in mirror and natural while none declares no bleed',
			run: async () => {
				// This case used to assert that `bleedSize` shaped the bleed box "in every
				// mode", `none` included: the pre-v2 contract always declared `art + 2 x
				// bleedSize`. Decision 3 reversed the `none` half, so the case now pins both
				// halves: the requested bleed really moves the geometry where it is used, and
				// `none` keeps the bleed box on the trim box whatever the bleed size is.
				for (const mode of ['mirror', 'natural'] as const) {
					await runGeneration(
						makeSettings({ cropMarks: 1, bleedMode: mode, bleedSize: SMALL_BLEED_MM })
					);
					const small = boxMM((await loadProducedPage(publishedBlobs[0])).getBleedBox());

					await runGeneration(
						makeSettings({ cropMarks: 1, bleedMode: mode, bleedSize: LARGE_BLEED_MM })
					);
					const large = boxMM((await loadProducedPage(publishedBlobs[0])).getBleedBox());

					assert(
						Math.abs(large.width - small.width - 2 * (LARGE_BLEED_MM - SMALL_BLEED_MM)) <
							TOLERANCE_MM,
						`${mode}: a larger bleed size must widen the bleed box by twice the difference, ` +
							`got ${small.width} mm then ${large.width} mm`
					);
				}

				for (const cropMarks of [0, 1] as const) {
					for (const bleedSize of [SMALL_BLEED_MM, LARGE_BLEED_MM]) {
						const row = rowFor(cropMarks, 'none', bleedSize);
						await runGeneration(
							makeSettings({ cropMarks, bleedMode: 'none', bleedSize })
						);
						await assertRowGeometry(row, `${rowLabel(row)} at ${bleedSize} mm bleed`);
					}
				}
			}
		},
		{
			name: 'bleed-modes: a bleed larger than the mark distance grows the page and reaches the media box with crop marks on',
			run: async () => {
				// Decision 2, the extreme of the table: the pre-v2 code kept the page at
				// `art + 2 x CROPLINE.DISTANCE` and clamped the bleed box to the media box, so
				// a 10 mm bleed could be declared but never filled. The page must grow to
				// `art + 2 x bleed` and the bleed box must reach the media box.
				for (const mode of ALL_MODES) {
					const row = rowFor(1, mode, LARGE_BLEED_MM);
					await runGeneration(
						makeSettings({ cropMarks: 1, bleedMode: mode, bleedSize: LARGE_BLEED_MM })
					);

					assertEqual(
						row.marginMM,
						LARGE_BLEED_MM,
						`${mode}: the margin must follow the larger bleed`
					);
					await assertRowGeometry(row, `${rowLabel(row)} at ${LARGE_BLEED_MM} mm bleed`);

					const page = await loadProducedPage(publishedBlobs[0]);
					const producedMedia = boxMM(page.getMediaBox());
					assert(
						producedMedia.width >
							DOCUMENT_WIDTH_MM + 2 * CROPLINE.DISTANCE + TOLERANCE_MM,
						`${mode}: the page must grow past the mark distance, got ` +
							`${producedMedia.width} mm`
					);
					if (mode === 'none') {
						assertBox(
							boxMM(page.getBleedBox()),
							boxMM(page.getTrimBox()),
							`${mode}: the bleed box must stay on the trim box`
						);
					} else {
						assertBox(
							boxMM(page.getBleedBox()),
							producedMedia,
							`${mode}: the bleed box must reach the media box`
						);
					}
				}
			}
		},
		{
			name: 'bleed-modes: none declares no bleed, so the produced bleed box equals the trim box in every combination',
			run: async () => {
				// Decision 3, asserted directly on the produced file instead of through the
				// table: whatever the crop marks and the bleed size are, `none` must write a
				// BleedBox equal to its TrimBox - an unused bleed size never reaches the file.
				for (const cropMarks of [0, 1] as const) {
					for (const bleedSize of [SMALL_BLEED_MM, LARGE_BLEED_MM]) {
						await runGeneration(
							makeSettings({ cropMarks, bleedMode: 'none', bleedSize })
						);
						const page = await loadProducedPage(publishedBlobs[0]);
						const producedBleed = boxMM(page.getBleedBox());
						const producedTrim = boxMM(page.getTrimBox());

						assertBox(
							producedBleed,
							producedTrim,
							`none with crop marks ${cropMarks} at ${bleedSize} mm bleed`
						);
						// The trim box still carries the artwork, so the equality above cannot be
						// satisfied by two boxes that are both wrong in the same way.
						assert(
							Math.abs(producedTrim.width - artworkSize().width) < TOLERANCE_MM &&
								Math.abs(producedTrim.height - artworkSize().height) < TOLERANCE_MM,
							`none with crop marks ${cropMarks} at ${bleedSize} mm bleed: the trim box must ` +
								`still carry the artwork size, got ${producedTrim.width} x ${producedTrim.height} mm`
						);
					}
				}
			}
		}
	];
}
