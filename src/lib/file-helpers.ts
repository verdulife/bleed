import type { PDFOptions, RepeatSettings } from '@/lib/types';
import { degrees, PDFDocument, PDFEmbeddedPage, PDFImage, PDFPage } from 'pdf-lib';
import { get } from 'svelte/store';
import { CROPLINE, FILE_TYPE, isJPEG, isPNG, POINTS_TO_MM, toPT } from '@/lib/constants';
import { userFiles, bleedSettings, repeatSettings } from '@/lib/stores';
import { drawMirrorBleed } from '@/lib/settings-helpers';
import { addCropMarks } from '@/lib/crop-marks';
import { closeCropMask, closeMask, openCropMask, openMask } from './pdf-extend';

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
	let fileExt = "pdf";

	if (isPNG(uint8Array)) fileExt = 'png';
	if (isJPEG(uint8Array)) fileExt = 'jpeg';

	return fileExt;
}

export async function inputFileAsync(onlyPdf = false): Promise<FileList> {
	const input = document.createElement('input');
	input.type = 'file';
	input.multiple = true;
	input.accept = onlyPdf ? 'application/pdf' : 'application/pdf, image/jpeg, image/png';
	input.click();

	return new Promise((resolve) => {
		input.addEventListener('change', () => {
			if (input.files) return resolve(input.files);
		});
	});
}

export async function pushFilesToStore(files: FileList) {
	Array.from(files).forEach(async (file: File) => {
		const fileType = await getFileType(file);
		const fileBuffer = await file.arrayBuffer();
		const fileName = file.name;

		userFiles.update((store) => {
			const id = store.length;
			return (store = [...store, { fileType, fileBuffer, fileName, id }]);
		});
	});
}

export function needsRotation(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const mediaBoxSize = page.getMediaBox();
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
			width: mediaBoxSize.width - toPT(bleedSizeMM) * 2,
			height: mediaBoxSize.height - toPT(bleedSizeMM) * 2
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
	const embedRatio = embedFile.width / embedFile.height;

	let width = Math.min(trimBoxSize.width, trimBoxSize.height * embedRatio);
	let height = Math.min(trimBoxSize.height, trimBoxSize.width / embedRatio);
	let x = (mediaBoxSize.width - width) / 2;
	let y = (mediaBoxSize.height - height) / 2;

	if (fit) {
		width = Math.max(trimBoxSize.width, trimBoxSize.height * embedRatio);
		height = Math.max(trimBoxSize.height, trimBoxSize.width / embedRatio);
		x = (mediaBoxSize.width - width) / 2;
		y = (mediaBoxSize.height - height) / 2;
	}

	return { x, y, width, height };
}

function drawPdf(embedFile: PDFEmbeddedPage, page: PDFPage, embedOptions: PDFOptions) {
	const { cropMarksAndBleed, mirrorBleed } = get(bleedSettings);

	if (cropMarksAndBleed) openCropMask(page);

	page.drawPage(embedFile as PDFEmbeddedPage, embedOptions);

	if (cropMarksAndBleed) {
		if (mirrorBleed) {
			drawMirrorBleed(page, embedFile, embedOptions);
		}

		closeCropMask(page);
		addCropMarks(page);
	}
}

function drawImage(embedFile: PDFImage, page: PDFPage, embedOptions: PDFOptions) {
	const { cropMarksAndBleed, mirrorBleed } = get(bleedSettings);

	if (cropMarksAndBleed) openCropMask(page);

	page.drawImage(embedFile as PDFImage, embedOptions);

	if (cropMarksAndBleed) {
		if (mirrorBleed) {
			drawMirrorBleed(page, embedFile, embedOptions);
		}

		closeCropMask(page);
		addCropMarks(page);
	}
}

export const fileHandler = {
	async [FILE_TYPE.PDF](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const loadedFiles = await PDFDocument.load(file);
		const embedPages = await pdfDoc.embedPages(loadedFiles.getPages());

		embedPages.forEach(async (embedFile) => {
			const page = pdfDoc.addPage();

			setDocument(embedFile, page);
			const embedOptions = setEmbed(embedFile, page);
			drawPdf(embedFile, page, embedOptions);
		});
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

function calcCenter(embedFile: PDFEmbeddedPage, page: PDFPage, settings: RepeatSettings, iterationX: number, iterationY: number) {
	const { width: pageWidth, height: pageHeight } = page.getSize();
	const { width: fileWidth, height: fileHeight } = embedFile;
	const { repeatX, repeatY } = settings;
	const repeatWidth = fileWidth * repeatX;
	const repeatHeight = fileHeight * repeatY;
	const centerX = pageWidth / 2 - repeatWidth / 2;
	const centerY = pageHeight / 2 - repeatHeight / 2;
	const posX = centerX + fileWidth * iterationX;
	const posY = centerY + fileHeight * iterationY;

	return { posX, posY };
}

export async function fileRepeat(pdfDoc: PDFDocument, file: ArrayBuffer, page: PDFPage) {
	const settings = get(repeatSettings);
	const loadedFiles = await PDFDocument.load(file);
	const embedPages = await pdfDoc.embedPages(loadedFiles.getPages());

	embedPages.forEach(async (embedFile) => {
		for (let x = 0; x < settings.repeatX; x++) {
			for (let y = 0; y < settings.repeatY; y++) {
				const { posX, posY } = calcCenter(embedFile, page, settings, x, y);
				const embedWidth = toPT(settings.embed.width);
				const embedHeight = toPT(settings.embed.height);

				if (settings.embed.width && settings.embed.height) {
					const maskOptions: PDFOptions = {
						x: posX + embedWidth / 2,
						y: posY + embedHeight / 2,
						width: embedWidth,
						height: embedHeight
					};

					openMask(page, maskOptions);
				}

				page.drawPage(embedFile as PDFEmbeddedPage, { x: posX, y: posY });

				if (settings.embed.width && settings.embed.height) closeMask(page);
			}
		}
	});
}
