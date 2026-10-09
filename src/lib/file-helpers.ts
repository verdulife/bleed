import type { BleedMode, PDFOptions } from '@/lib/types';
import { degrees, PDFDocument, PDFEmbeddedPage, PDFImage, PDFPage } from 'pdf-lib';
import { get } from 'svelte/store';
import { FILE_TYPE, isJPEG, isPDF, isPNG, POINTS_TO_MM, toMM, toPT } from '@/lib/constants';
import { userFiles, bleedSettings, manualOrder } from '@/lib/stores';
import { addFilesInOrder } from '@/lib/file-order';
import { computePageBoxes, type PageBox } from '@/lib/page-boxes';
import { drawMirrorBleed } from '@/lib/settings-helpers';
import { addCropMarks } from '@/lib/crop-marks';
import {
	clipExtendsToBleed,
	declaredBleedMM,
	drawsMirrorBleed,
	pageMarginMM,
	resolveArtworkTargetBox,
	usesCoverFit
} from '@/lib/bleed-mode';
import { closeCropMask, openCropMask } from './pdf-extend';

export function getFileURL(file: File) {
	return URL.createObjectURL(file);
}

export async function getFileType(file: File) {
	function readBufferHeader(file: File, start = 0, end = 8): Promise<ArrayBuffer> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				resolve(reader.result as ArrayBuffer);
			};
			reader.onerror = reject;
			reader.readAsArrayBuffer(file.slice(start, end));
		});
	}

	const buffers = await readBufferHeader(file);
	const uint8Array = new Uint8Array(buffers);

	if (isPDF(uint8Array)) return FILE_TYPE.PDF;
	if (isPNG(uint8Array)) return FILE_TYPE.PNG;
	if (isJPEG(uint8Array)) return FILE_TYPE.JPEG;

	throw new Error('Unsupported file type');
}

export async function inputFileAsync(): Promise<FileList> {
	const input = document.createElement('input');
	input.type = 'file';
	input.multiple = true;
	input.accept = 'application/pdf, image/jpeg, image/png';
	input.click();

	return new Promise((resolve) => {
		input.addEventListener('change', () => {
			if (input.files) return resolve(input.files);
		});
	});
}

/**
 * Monotonic id source for every file pushed into the store. Ids must stay unique for
 * the whole session: they are used as `{#each ... (file.id)}` keys, for removal by id,
 * and they are handed to `svelte-dnd-action`, which requires unique item ids.
 * A positional id (`get(userFiles).length + index`) is wrong because the store shrinks
 * when a file is removed, so the next add reuses an id that is already in use.
 */
let nextFileId = 0;

export async function pushFilesToStore(files: FileList) {
	const results = await Promise.allSettled(
		Array.from(files).map(async (file) => {
			// The id is reserved synchronously, before the first `await`: the map callbacks
			// run concurrently under `Promise.allSettled`, so reading the counter after an
			// await could not follow the incoming array order.
			const id = nextFileId++;
			const fileType = await getFileType(file);
			const fileBuffer = await file.arrayBuffer();
			return { fileType, fileBuffer, fileName: file.name, id };
		})
	);

	const validFiles: Array<{ fileType: string; fileBuffer: ArrayBuffer; fileName: string; id: number }> = [];
	results.forEach((result, index) => {
		if (result.status === 'rejected') {
			alert(`Error loading "${files[index].name}": ${(result.reason as Error).message}`);
		} else {
			validFiles.push(result.value);
		}
	});

	userFiles.set(addFilesInOrder(get(userFiles), validFiles, get(manualOrder)));
}

export function needsRotation(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const mediaBoxSize = page.getMediaBox();
	if (!mediaBoxSize.height || !embedFile.height) return false;

	const mediaBoxRatio = mediaBoxSize.width / mediaBoxSize.height;
	const embedRatio = embedFile.width / embedFile.height;

	return ((embedRatio > 1 && mediaBoxRatio < 1) || (embedRatio < 1 && mediaBoxRatio > 1));
}

/**
 * A source page carries artwork only when it has a content stream. `page.node.Contents()`
 * is `undefined` for blank pages (blank backs, separators, annotation-only pages), which
 * pdf-lib cannot embed. `node` and `Contents()` are public, so no cast is needed here.
 */
function hasContents(page: PDFPage) {
	return page.node.Contents() !== undefined;
}

/**
 * Applies the output page geometry via `computePageBoxes`, the single source of truth for
 * the box math.
 *
 * The margin and the declared bleed are two independent decisions of `bleed-mode.ts`
 * (`pageMarginMM`, `declaredBleedMM`), one per row of the acceptance table: the margin
 * holds the crop marks and/or the bleed area, while `none` declares no bleed at all, so its
 * BleedBox equals the TrimBox. `rotate` swaps the artwork axes first, and is only ever true
 * for the artwork path (an empty page has no aspect ratio to rotate against).
 */
function applyPageGeometry(
	page: PDFPage,
	artworkWidthMM: number,
	artworkHeightMM: number,
	rotate: boolean
) {
	const { cropMarks, bleedMode, bleedSize: bleedSizeMM } = get(bleedSettings);
	let userWidthMM = artworkWidthMM;
	let userHeightMM = artworkHeightMM;

	if (rotate) {
		const tempWidth = userWidthMM;
		userWidthMM = userHeightMM;
		userHeightMM = tempWidth;
	}

	const boxes = computePageBoxes(
		userWidthMM,
		userHeightMM,
		pageMarginMM(cropMarks, bleedMode, bleedSizeMM),
		declaredBleedMM(bleedMode, bleedSizeMM)
	);

	page.setMediaBox(
		toPT(boxes.media.x),
		toPT(boxes.media.y),
		toPT(boxes.media.width),
		toPT(boxes.media.height)
	);
	page.setBleedBox(
		toPT(boxes.bleed.x),
		toPT(boxes.bleed.y),
		toPT(boxes.bleed.width),
		toPT(boxes.bleed.height)
	);
	page.setTrimBox(
		toPT(boxes.trim.x),
		toPT(boxes.trim.y),
		toPT(boxes.trim.width),
		toPT(boxes.trim.height)
	);
	page.setSize(toPT(boxes.media.width), toPT(boxes.media.height));
}

function setDocument(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const { document, autoRotate } = get(bleedSettings);
	const embedFileRatio = embedFile.width / embedFile.height;
	let { width: userWidthMM, height: userHeightMM } = document;

	if (!userWidthMM && !userHeightMM) {
		userWidthMM = embedFile.width * POINTS_TO_MM;
		userHeightMM = embedFile.height * POINTS_TO_MM;
	};

	if (!userWidthMM) userWidthMM = document.height * embedFileRatio;
	if (!userHeightMM) userHeightMM = document.width / embedFileRatio;

	// `needsRotation` compares the artwork ratio against the page media box, so the
	// artwork size must already be on the page when it is asked; `applyPageGeometry`
	// then sets the final, crop-mark-aware boxes.
	page.setSize(toPT(userWidthMM), toPT(userHeightMM));
	const rotate = autoRotate === 1 && needsRotation(embedFile, page);

	applyPageGeometry(page, userWidthMM, userHeightMM, rotate);

	return rotate;
}

/**
 * Fits the artwork into `targetBox`, the box the artwork is placed on. The caller resolves
 * it through `resolveArtworkTargetBox`, so it is already in points: `none` and `mirror` fit
 * the artwork into the trim box, while `natural` fits it into the bleed box so the artwork
 * itself covers the bleed area (B3 in the feature document).
 *
 * `cover` is the **effective** cover decision, already resolved by
 * `usesCoverFit(fit, mode)`: `natural` always covers the bleed area whatever `Crop to fit`
 * says (decision 1), so the crop-fit policy lives in `bleed-mode.ts` and this function owns
 * only the geometry.
 */
function setEmbed(
	embedFile: PDFEmbeddedPage | PDFImage,
	page: PDFPage,
	targetBox: PageBox,
	cover: boolean
) {
	const mediaBoxSize = page.getMediaBox();
	const safeTargetBox = targetBox.width === 0 ? mediaBoxSize : targetBox;
	const embedRatio = embedFile.width / embedFile.height;

	let width = Math.min(safeTargetBox.width, safeTargetBox.height * embedRatio);
	let height = Math.min(safeTargetBox.height, safeTargetBox.width / embedRatio);
	let x = (mediaBoxSize.width - width) / 2;
	let y = (mediaBoxSize.height - height) / 2;

	if (cover) {
		width = Math.max(safeTargetBox.width, safeTargetBox.height * embedRatio);
		height = Math.max(safeTargetBox.height, safeTargetBox.width / embedRatio);
		x = (mediaBoxSize.width - width) / 2;
		y = (mediaBoxSize.height - height) / 2;
	}

	return { x, y, width, height };
}

/**
 * The box the artwork is clipped to, the other half of the mode decision: `none` clips to
 * the trim box so the artwork cannot escape into the mark margin, while `mirror` and
 * `natural` clip to the bleed box so the fill may reach the bleed line. Resolved on the
 * page, after `applyPageGeometry`, so it is a read in points.
 */
function artworkClipBox(page: PDFPage, mode: BleedMode): PageBox {
	return clipExtendsToBleed(mode) ? page.getBleedBox() : page.getTrimBox();
}

export function embedFileOnPage(
	embedFile: PDFEmbeddedPage | PDFImage,
	page: PDFPage,
	embedOptions: PDFOptions,
	applyMirrorBleed: boolean,
	clipBox: PageBox
) {
	openCropMask(page, clipBox);

	if (embedFile.constructor.name.toLowerCase().includes('page')) {
		page.drawPage(embedFile as PDFEmbeddedPage, embedOptions);
	} else {
		page.drawImage(embedFile as PDFImage, embedOptions);
	}

	if (applyMirrorBleed) {
		drawMirrorBleed(page, embedFile, embedOptions);
	}

	closeCropMask(page);
}

/** Crop marks are drawn the same way for pages with artwork and for empty pages. */
function addCropMarksIfEnabled(page: PDFPage) {
	if (get(bleedSettings).cropMarks) addCropMarks(page);
}

/**
 * One output page carrying the prepress geometry and the crop marks but no artwork: the
 * shared primitive for an intentional empty page. Both the blank template of an empty file
 * list (`generatePDF`, B2) and a source page without a content stream (a blank back, a
 * separator, a page that only carries annotations) are exactly this page, so neither the
 * box math nor the crop-mark decision is duplicated between them.
 *
 * The size is passed in millimetres. `rotate` is always false: rotation follows from the
 * artwork aspect ratio, and a page without artwork has none to rotate against.
 */
export function addBlankPage(pdfDoc: PDFDocument, widthMM: number, heightMM: number): PDFPage {
	const page = pdfDoc.addPage();

	applyPageGeometry(page, widthMM, heightMM, false);
	addCropMarksIfEnabled(page);

	return page;
}

function drawPdf(embedFile: PDFEmbeddedPage, page: PDFPage, embedOptions: PDFOptions) {
	const { bleedMode } = get(bleedSettings);

	embedFileOnPage(
		embedFile,
		page,
		embedOptions,
		drawsMirrorBleed(bleedMode),
		artworkClipBox(page, bleedMode)
	);
	addCropMarksIfEnabled(page);
}

function drawImage(embedFile: PDFImage, page: PDFPage, embedOptions: PDFOptions) {
	const { bleedMode } = get(bleedSettings);

	embedFileOnPage(
		embedFile,
		page,
		embedOptions,
		drawsMirrorBleed(bleedMode),
		artworkClipBox(page, bleedMode)
	);
	addCropMarksIfEnabled(page);
}

export const fileHandler = {
	async [FILE_TYPE.PDF](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const loadedFiles = await PDFDocument.load(file, { ignoreEncryption: true });
		const sourcePages = loadedFiles.getPages();

		// Blank source pages must never reach `embedPages`: pdf-lib registers every embedder
		// it hands out on the output document, and a page without a content stream throws
		// from `flush()` (that is, from `save()`) even when nothing was drawn with it.
		const embeddablePages = sourcePages.filter((sourcePage) => hasContents(sourcePage));
		const embedPages = await pdfDoc.embedPages(embeddablePages);
		let embedIndex = 0;

		for (const sourcePage of sourcePages) {
			// A source page without a content stream (a blank back, a separator, a page
			// carrying only annotations) has no artwork to embed. Keep the page instead:
			// same geometry and crop marks as a real page, no artwork. Its source size is a
			// point value, and `addBlankPage` takes millimetres.
			if (!hasContents(sourcePage)) {
				const mediaBox = sourcePage.getMediaBox();
				addBlankPage(pdfDoc, toMM(mediaBox.width), toMM(mediaBox.height));
				continue;
			}

			const page = pdfDoc.addPage();
			const embedFile = embedPages[embedIndex];
			embedIndex += 1;

			setDocument(embedFile, page);
			const { fit, bleedMode } = get(bleedSettings);
			const embedOptions = setEmbed(
				embedFile,
				page,
				resolveArtworkTargetBox(page, bleedMode),
				usesCoverFit(fit, bleedMode)
			);
			drawPdf(embedFile, page, embedOptions);
		}
	},

	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const embedFile = await pdfDoc.embedJpg(file);
		const page = pdfDoc.addPage();

		const rotate = setDocument(embedFile, page);
		const { fit, bleedMode } = get(bleedSettings);
		const embedOptions = setEmbed(
			embedFile,
			page,
			resolveArtworkTargetBox(page, bleedMode),
			usesCoverFit(fit, bleedMode)
		);
		drawImage(embedFile, page, embedOptions);

		if (rotate) page.setRotation(degrees(-90));
	},

	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const embedFile = await pdfDoc.embedPng(file);
		const page = pdfDoc.addPage();

		setDocument(embedFile, page);
		const { fit, bleedMode } = get(bleedSettings);
		const embedOptions = setEmbed(
			embedFile,
			page,
			resolveArtworkTargetBox(page, bleedMode),
			usesCoverFit(fit, bleedMode)
		);
		drawImage(embedFile, page, embedOptions);
	}
};
