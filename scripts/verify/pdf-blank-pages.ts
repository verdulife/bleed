/**
 * Verification cases for defect D1 ("a single blank page kills the whole document").
 *
 * A source PDF page without a content stream (blank backs, separators, pages that only
 * carry annotations) must become an empty output page with the usual prepress geometry
 * instead of aborting the whole document. pdf-lib defers page embedding to `save()`,
 * so on the unfixed code the regression case fails with `MissingPageContentsEmbeddingError`
 * ("Can't embed page with missing Contents") raised from `save()` - outside the per-file
 * `try/catch` in `generatePDF`, which is why the user got `alert('Error generating PDF')`.
 *
 * The cases drive the real `fileHandler[FILE_TYPE.PDF]` path with pdf-lib fixtures.
 * Bytes are handed over as an `ArrayBuffer` directly, so the browser `FileReader` is not
 * involved; only `alert` is recorded (see the wrapper below).
 */
import { CROPLINE, FILE_TYPE, toMM, toPT } from '@/lib/constants';
import { PDFDocument, rgb } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { VerifyCase } from './harness';
import { assert, assertEqual } from './harness';

// --- `alert` recording --------------------------------------------------------

/**
 * The real flow only alerts on a generation failure (`generatePDF`), never inside
 * `fileHandler`, but the regression is silent unless something observes it, so the cases
 * assert that no alert was raised. `file-ids.ts` installs the primary test double; this
 * module wraps whatever `alert` already is instead of replacing it, so the two modules
 * keep separate records (the runner imports `file-ids` first, in module order).
 */
const alertMessages: string[] = [];
const previousAlert = (globalThis as unknown as { alert?: (message?: unknown) => void }).alert;

(globalThis as unknown as { alert: (message?: unknown) => void }).alert = (message?: unknown) => {
	alertMessages.push(String(message));
	previousAlert?.(message);
};

// --- module under test (loaded dynamically, like the other modules) -----------

type FileHelpersModule = typeof import('@/lib/file-helpers');
type StoresModule = typeof import('@/lib/stores');

let loadedHelpers: Promise<FileHelpersModule> | null = null;

function loadModuleUnderTest(): Promise<FileHelpersModule> {
	loadedHelpers ??= import('@/lib/file-helpers');
	return loadedHelpers;
}

async function loadStores(): Promise<StoresModule> {
	return import('@/lib/stores');
}

// --- fixture & settings -------------------------------------------------------

/** The document size the user configured, and the size of the default source pages. */
const DOCUMENT_WIDTH_MM = 100;
const DOCUMENT_HEIGHT_MM = 150;

/**
 * The historical fixed point (`CROPLINE.SIZE - CROPLINE.OVERLAY`), kept as the fixture's
 * bleed because it is a bleed below the mark distance. D3 was that the old box math only
 * put the trim box on the artwork at this value; the v2 math
 * (`computePageBoxes(art, art, margin, declaredBleed)`) is exact for every bleed size, so
 * the value no longer carries the correctness of the expectations below. T2 made 3 mm the
 * store default too, so the fixture passes it explicitly on purpose: these cases must not
 * inherit a future default change.
 */
const BLEED_SIZE_MM = CROPLINE.SIZE - CROPLINE.OVERLAY;

type SourcePageKind = 'painted' | 'blank';

type SourcePageSpec = {
	kind: SourcePageKind;
	/** Defaults to the configured document size, so a spec can override one page only. */
	widthMM?: number;
	heightMM?: number;
};

/** Builds a source PDF whose pages are either painted (content stream) or left empty. */
async function buildFixture(specs: SourcePageSpec[]): Promise<ArrayBuffer> {
	const source = await PDFDocument.create();

	for (const spec of specs) {
		const page = source.addPage([
			toPT(spec.widthMM ?? DOCUMENT_WIDTH_MM),
			toPT(spec.heightMM ?? DOCUMENT_HEIGHT_MM)
		]);
		if (spec.kind === 'painted') {
			page.drawRectangle({ x: 10, y: 20, width: 40, height: 50, color: rgb(0.2, 0.4, 0.6) });
		}
	}

	const bytes = await source.save();
	return bytes.slice().buffer as ArrayBuffer;
}

/** Guards the fixture itself: a bare `addPage()` must stay free of a content stream. */
async function assertFixtureShape(fixture: ArrayBuffer, hasContents: boolean[]) {
	const source = await PDFDocument.load(fixture);
	const pages = source.getPages();

	assertEqual(pages.length, hasContents.length, 'fixture must have the expected page count');
	pages.forEach((page, index) => {
		assertEqual(
			page.node.Contents() !== undefined,
			hasContents[index],
			`fixture page ${index} content stream presence`
		);
	});
}

async function setSettings(cropMarks: 0 | 1) {
	const { bleedSettings } = await loadStores();
	bleedSettings.set({
		document: { width: DOCUMENT_WIDTH_MM, height: DOCUMENT_HEIGHT_MM },
		fit: 1,
		autoRotate: 1,
		cropMarks,
		bleedSize: BLEED_SIZE_MM,
		bleedMode: 'none'
	});
}

/** Runs the real per-file handler on the fixture, as `generatePDF` does per file. */
async function runHandler(fixture: ArrayBuffer): Promise<PDFDocument> {
	const { fileHandler } = await loadModuleUnderTest();
	const output = await PDFDocument.create();
	await fileHandler[FILE_TYPE.PDF](output, fixture);
	return output;
}

// --- geometry assertions ------------------------------------------------------

/** Point coordinates come back from pdf-lib, so compare in mm with float noise allowed. */
const MM_EPSILON = 1e-6;

function assertBoxMM(actualPT: number, expectedMM: number, label: string) {
	const actualMM = toMM(actualPT);
	assert(
		Math.abs(actualMM - expectedMM) < MM_EPSILON,
		`${label}: expected ${expectedMM} mm, got ${actualMM} mm`
	);
}

/**
 * With crop marks on and `bleedMode: 'none'`, every output page - painted or blank - must
 * carry the artwork geometry: media box grown by the mark margin, trim box on the artwork,
 * and a bleed box equal to the trim box.
 */
function assertPageGeometry(
	page: PDFPage,
	label: string,
	widthMM = DOCUMENT_WIDTH_MM,
	heightMM = DOCUMENT_HEIGHT_MM
) {
	const media = page.getMediaBox();
	const bleed = page.getBleedBox();
	const trim = page.getTrimBox();

	assertBoxMM(media.x, 0, `${label} media x`);
	assertBoxMM(media.y, 0, `${label} media y`);
	assertBoxMM(media.width, widthMM + 2 * CROPLINE.DISTANCE, `${label} media width`);
	assertBoxMM(media.height, heightMM + 2 * CROPLINE.DISTANCE, `${label} media height`);

	// v2 decision 3 moved this expectation: the bleed box used to be
	// `art + 2 x BLEED_SIZE_MM`, because the pre-v2 contract declared a bleed in `none`
	// mode too. `none` now declares **no** bleed, so the produced BleedBox equals the
	// TrimBox: the artwork, still at the mark margin.
	assertBoxMM(bleed.x, CROPLINE.DISTANCE, `${label} bleed x`);
	assertBoxMM(bleed.y, CROPLINE.DISTANCE, `${label} bleed y`);
	assertBoxMM(bleed.width, widthMM, `${label} bleed width`);
	assertBoxMM(bleed.height, heightMM, `${label} bleed height`);

	assertBoxMM(trim.x, CROPLINE.DISTANCE, `${label} trim x`);
	assertBoxMM(trim.y, CROPLINE.DISTANCE, `${label} trim y`);
	assertBoxMM(trim.width, widthMM, `${label} trim width`);
	assertBoxMM(trim.height, heightMM, `${label} trim height`);
}

/** With crop marks off, all three boxes collapse onto the artwork. */
function assertPlainPageGeometry(page: PDFPage, label: string) {
	const boxes = [
		['media', page.getMediaBox()],
		['bleed', page.getBleedBox()],
		['trim', page.getTrimBox()]
	] as const;

	for (const [name, box] of boxes) {
		assertBoxMM(box.x, 0, `${label} ${name} x`);
		assertBoxMM(box.y, 0, `${label} ${name} y`);
		assertBoxMM(box.width, DOCUMENT_WIDTH_MM, `${label} ${name} width`);
		assertBoxMM(box.height, DOCUMENT_HEIGHT_MM, `${label} ${name} height`);
	}
}

// --- cases --------------------------------------------------------------------

export function getPdfBlankPageCases(): VerifyCase[] {
	return [
		{
			name: 'pdf-blank-pages: a source page without a content stream no longer aborts the document',
			run: async () => {
				const fixture = await buildFixture([{ kind: 'painted' }, { kind: 'blank' }]);
				await assertFixtureShape(fixture, [true, false]);
				await setSettings(1);
				alertMessages.length = 0;

				const output = await runHandler(fixture);

				assertEqual(output.getPageCount(), 2, 'both source pages must be preserved');
				const bytes = await output.save({ addDefaultPage: false });
				assert(bytes.length > 0, 'the saved document must not be empty');
				assertEqual(
					alertMessages.length,
					0,
					`no alert may be raised, got "${alertMessages.join(' | ')}"`
				);
			}
		},
		{
			name: 'pdf-blank-pages: the blank page keeps the artwork geometry and still gets crop marks',
			run: async () => {
				const fixture = await buildFixture([{ kind: 'painted' }, { kind: 'blank' }]);
				await assertFixtureShape(fixture, [true, false]);
				await setSettings(1);

				const output = await runHandler(fixture);

				assertEqual(output.getPageCount(), 2, 'both source pages must be preserved');
				assertPageGeometry(output.getPage(0), 'painted page');
				assertPageGeometry(output.getPage(1), 'blank page');
				// `addCropMarks` is the only thing that can give a blank page a content
				// stream, so its presence proves the crop marks were drawn.
				assert(
					output.getPage(1).node.Contents() !== undefined,
					'the blank page must still get crop marks when crop marks are on'
				);
				await output.save({ addDefaultPage: false });
			}
		},
		{
			name: 'pdf-blank-pages: a document whose only page is blank still saves as a valid single page',
			run: async () => {
				const fixture = await buildFixture([{ kind: 'blank' }]);
				await assertFixtureShape(fixture, [false]);
				await setSettings(1);
				alertMessages.length = 0;

				const output = await runHandler(fixture);

				assertEqual(output.getPageCount(), 1, 'the single source page must be preserved');
				assertPageGeometry(output.getPage(0), 'blank page');
				const bytes = await output.save({ addDefaultPage: false });
				assert(bytes.length > 0, 'the saved document must not be empty');
				assertEqual(
					alertMessages.length,
					0,
					`no alert may be raised, got "${alertMessages.join(' | ')}"`
				);
			}
		},
		{
			name: 'pdf-blank-pages: page order is preserved and a blank page keeps its own source size',
			run: async () => {
				// The middle page is landscape and blank: only its own MediaBox can produce
				// that geometry, so both the position in the document and the source-derived
				// size are observable in the output.
				const fixture = await buildFixture([
					{ kind: 'painted' },
					{ kind: 'blank', widthMM: 200, heightMM: 100 },
					{ kind: 'painted' }
				]);
				await assertFixtureShape(fixture, [true, false, true]);
				await setSettings(1);

				const output = await runHandler(fixture);

				assertEqual(output.getPageCount(), 3, 'every source page must be preserved');
				assertPageGeometry(output.getPage(0), 'first painted page');
				assertPageGeometry(output.getPage(1), 'middle blank page', 200, 100);
				assertPageGeometry(output.getPage(2), 'last painted page');
				await output.save({ addDefaultPage: false });
			}
		},
		{
			name: 'pdf-blank-pages: a blank page saves without crop marks and without a content stream',
			run: async () => {
				const fixture = await buildFixture([{ kind: 'blank' }]);
				await assertFixtureShape(fixture, [false]);
				await setSettings(0);
				alertMessages.length = 0;

				const output = await runHandler(fixture);

				assertEqual(output.getPageCount(), 1, 'the single source page must be preserved');
				assertPlainPageGeometry(output.getPage(0), 'blank page');
				assert(
					output.getPage(0).node.Contents() === undefined,
					'with crop marks off the blank page must stay free of a content stream'
				);
				const bytes = await output.save({ addDefaultPage: false });
				assert(bytes.length > 0, 'the saved document must not be empty');
				assertEqual(
					alertMessages.length,
					0,
					`no alert may be raised, got "${alertMessages.join(' | ')}"`
				);
			}
		}
	];
}
