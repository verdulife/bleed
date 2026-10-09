import type { PDFOptions } from '@/lib/types';
import { degrees, PDFDocument, PDFEmbeddedPage, PDFImage, PDFPage } from 'pdf-lib';
import { get } from 'svelte/store';
import { CROPLINE, FILE_TYPE, isJPEG, isPDF, isPNG, POINTS_TO_MM, toPT } from '@/lib/constants';
import { userFiles, bleedSettings, manualOrder } from '@/lib/stores';
import { addFilesInOrder } from '@/lib/file-order';
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

function setDocument(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const { document, cropMarksAndBleed, bleedSize: bleedSizeMM, autoRotate } = get(bleedSettings);
	const embedFileRatio = embedFile.width / embedFile.height;
	let { width: userWidthMM, height: userHeightMM } = document;

	if (!userWidthMM && !userHeightMM) {
		userWidthMM = embedFile.width * POINTS_TO_MM;
		userHeightMM = embedFile.height * POINTS_TO_MM;
	};

	if (!userWidthMM) userWidthMM = document.height * embedFileRatio;
	if (!userHeightMM) userHeightMM = document.width / embedFileRatio;

	page.setSize(toPT(userWidthMM), toPT(userHeightMM));
	let rotate = autoRotate && needsRotation(embedFile, page);

	let mediaBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
	let bleedBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
	let trimBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };

	if (rotate) {
		const tempWidth = userWidthMM;
		userWidthMM = userHeightMM;
		userHeightMM = tempWidth;

		mediaBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
		bleedBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
		trimBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
	}

	if (cropMarksAndBleed) {
		const cropMarkSizeMM = CROPLINE.SIZE - CROPLINE.OVERLAY;

		mediaBoxSize = {
			x: 0,
			y: 0,
			width: toPT(CROPLINE.DISTANCE) * 2 + toPT(userWidthMM),
			height: toPT(CROPLINE.DISTANCE) * 2 + toPT(userHeightMM)
		}

		bleedBoxSize = {
			x: toPT(cropMarkSizeMM),
			y: toPT(cropMarkSizeMM),
			width: mediaBoxSize.width - toPT(cropMarkSizeMM) * 2,
			height: mediaBoxSize.height - toPT(cropMarkSizeMM) * 2
		}

		trimBoxSize = {
			x: toPT(bleedSizeMM + cropMarkSizeMM),
			y: toPT(bleedSizeMM + cropMarkSizeMM),
			width: mediaBoxSize.width - toPT(bleedSizeMM) * 2 - toPT(cropMarkSizeMM) * 2,
			height: mediaBoxSize.height - toPT(bleedSizeMM) * 2 - toPT(cropMarkSizeMM) * 2
		}
	}

	page.setMediaBox(
		mediaBoxSize.x,
		mediaBoxSize.y,
		mediaBoxSize.width,
		mediaBoxSize.height
	);
	page.setBleedBox(
		bleedBoxSize.x,
		bleedBoxSize.y,
		bleedBoxSize.width,
		bleedBoxSize.height
	);
	page.setTrimBox(
		trimBoxSize.x,
		trimBoxSize.y,
		trimBoxSize.width,
		trimBoxSize.height
	);
	page.setSize(mediaBoxSize.width, mediaBoxSize.height);

	return rotate;
}

function setEmbed(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const { fit } = get(bleedSettings);
	const mediaBoxSize = page.getMediaBox();
	const trimBoxSize = page.getTrimBox();
	const safeTrimBox = trimBoxSize.width === 0 ? mediaBoxSize : trimBoxSize;
	const embedRatio = embedFile.width / embedFile.height;

	let width = Math.min(safeTrimBox.width, safeTrimBox.height * embedRatio);
	let height = Math.min(safeTrimBox.height, safeTrimBox.width / embedRatio);
	let x = (mediaBoxSize.width - width) / 2;
	let y = (mediaBoxSize.height - height) / 2;

	if (fit) {
		width = Math.max(safeTrimBox.width, safeTrimBox.height * embedRatio);
		height = Math.max(safeTrimBox.height, safeTrimBox.width / embedRatio);
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

function drawPdf(embedFile: PDFEmbeddedPage, page: PDFPage, embedOptions: PDFOptions) {
	const { cropMarksAndBleed, mirrorBleed } = get(bleedSettings);

	embedFileOnPage(embedFile, page, embedOptions, !!mirrorBleed);

	if (cropMarksAndBleed) {
		addCropMarks(page);
	}
}

function drawImage(embedFile: PDFImage, page: PDFPage, embedOptions: PDFOptions) {
	const { cropMarksAndBleed, mirrorBleed } = get(bleedSettings);

	embedFileOnPage(embedFile, page, embedOptions, !!mirrorBleed);

	if (cropMarksAndBleed) {
		addCropMarks(page);
	}
}

export const fileHandler = {
	async [FILE_TYPE.PDF](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const loadedFiles = await PDFDocument.load(file, { ignoreEncryption: true });
		const embedPages = await pdfDoc.embedPages(loadedFiles.getPages());

		for (const embedFile of embedPages) {
			const page = pdfDoc.addPage();

			setDocument(embedFile, page);
			const embedOptions = setEmbed(embedFile, page);
			drawPdf(embedFile, page, embedOptions);
		}
	},

	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const embedFile = await pdfDoc.embedJpg(file);
		const page = pdfDoc.addPage();

		const rotate = setDocument(embedFile, page);
		const embedOptions = setEmbed(embedFile, page);
		drawImage(embedFile, page, embedOptions);

		if (rotate) page.setRotation(degrees(-90));
	},

	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const embedFile = await pdfDoc.embedPng(file);
		const page = pdfDoc.addPage();

		setDocument(embedFile, page);
		const embedOptions = setEmbed(embedFile, page);
		drawImage(embedFile, page, embedOptions);
	}
};
