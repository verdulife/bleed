import type { PDFOptions } from '@/lib/types';
import { degrees, PDFDocument, PDFEmbeddedPage, PDFImage, PDFPage } from 'pdf-lib';
import { get } from 'svelte/store';
import { FILE_TYPE, isJPEG, isPDF, isPNG, POINTS_TO_MM, toMM, toPT } from '@/lib/constants';
import { userFiles, bleedSettings, manualOrder } from '@/lib/stores';
import { addFilesInOrder } from '@/lib/file-order';
import { computePageBoxes, type PageBox } from '@/lib/page-boxes';
import { drawMirrorBleed } from '@/lib/settings-helpers';
import { addCropMarks } from '@/lib/crop-marks';
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
 * the box math. `rotate` swaps the artwork axes first, and is only ever true for the
 * artwork path (an empty page has no aspect ratio to rotate against).
 */
function applyPageGeometry(
	page: PDFPage,
	artworkWidthMM: number,
	artworkHeightMM: number,
	rotate: boolean
) {
	const { cropMarksAndBleed, bleedSize: bleedSizeMM } = get(bleedSettings);
	let userWidthMM = artworkWidthMM;
	let userHeightMM = artworkHeightMM;

	if (rotate) {
		const tempWidth = userWidthMM;
		userWidthMM = userHeightMM;
		userHeightMM = tempWidth;
	}

	const boxes = computePageBoxes(userWidthMM, userHeightMM, bleedSizeMM, !!cropMarksAndBleed);

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
 * Fits the artwork into `targetBox`, the box the artwork is placed on. The caller reads it
 * from the page (`page.getTrimBox()` today), so it is already in points. Contain and cover
 * are the untouched `fit` semantics; only the target box is parameterised, so a later
 * bleed mode can fit the artwork to the bleed box instead of the trim box (B3 in the
 * feature document) without changing this routine.
 */
function setEmbed(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage, targetBox: PageBox) {
	const { fit } = get(bleedSettings);
	const mediaBoxSize = page.getMediaBox();
	const safeTargetBox = targetBox.width === 0 ? mediaBoxSize : targetBox;
	const embedRatio = embedFile.width / embedFile.height;

	let width = Math.min(safeTargetBox.width, safeTargetBox.height * embedRatio);
	let height = Math.min(safeTargetBox.height, safeTargetBox.width / embedRatio);
	let x = (mediaBoxSize.width - width) / 2;
	let y = (mediaBoxSize.height - height) / 2;

	if (fit) {
		width = Math.max(safeTargetBox.width, safeTargetBox.height * embedRatio);
		height = Math.max(safeTargetBox.height, safeTargetBox.width / embedRatio);
		x = (mediaBoxSize.width - width) / 2;
		y = (mediaBoxSize.height - height) / 2;
	}

	return { x, y, width, height };
}

export function embedFileOnPage(
	embedFile: PDFEmbeddedPage | PDFImage,
	page: PDFPage,
	embedOptions: PDFOptions,
	applyMirrorBleed: boolean
) {
	openCropMask(page);

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
	if (get(bleedSettings).cropMarksAndBleed) addCropMarks(page);
}

function drawPdf(embedFile: PDFEmbeddedPage, page: PDFPage, embedOptions: PDFOptions) {
	const { mirrorBleed } = get(bleedSettings);

	embedFileOnPage(embedFile, page, embedOptions, !!mirrorBleed);
	addCropMarksIfEnabled(page);
}

function drawImage(embedFile: PDFImage, page: PDFPage, embedOptions: PDFOptions) {
	const { mirrorBleed } = get(bleedSettings);

	embedFileOnPage(embedFile, page, embedOptions, !!mirrorBleed);
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
			const page = pdfDoc.addPage();

			// A source page without a content stream (a blank back, a separator, a page
			// carrying only annotations) has no artwork to embed. Keep the page instead:
			// same geometry and crop marks as a real page, no artwork.
			if (!hasContents(sourcePage)) {
				const mediaBox = sourcePage.getMediaBox();
				// Rotation follows from the artwork aspect ratio, and an empty page has no
				// artwork to rotate against, so the flag is false here.
				applyPageGeometry(page, toMM(mediaBox.width), toMM(mediaBox.height), false);
				addCropMarksIfEnabled(page);
				continue;
			}

			const embedFile = embedPages[embedIndex];
			embedIndex += 1;

			setDocument(embedFile, page);
			const embedOptions = setEmbed(embedFile, page, page.getTrimBox());
			drawPdf(embedFile, page, embedOptions);
		}
	},

	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const embedFile = await pdfDoc.embedJpg(file);
		const page = pdfDoc.addPage();

		const rotate = setDocument(embedFile, page);
		const embedOptions = setEmbed(embedFile, page, page.getTrimBox());
		drawImage(embedFile, page, embedOptions);

		if (rotate) page.setRotation(degrees(-90));
	},

	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const embedFile = await pdfDoc.embedPng(file);
		const page = pdfDoc.addPage();

		setDocument(embedFile, page);
		const embedOptions = setEmbed(embedFile, page, page.getTrimBox());
		drawImage(embedFile, page, embedOptions);
	}
};
