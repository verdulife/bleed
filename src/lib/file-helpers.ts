import type { PDFEmbedOptions } from '@/lib/types';
import { degrees, PDFDocument, PDFEmbeddedPage, PDFImage, PDFPage } from 'pdf-lib';
import { get } from 'svelte/store';
import { CROPLINE, FILE_TYPE, isJPEG, isPNG, POINTS_TO_MM, toPT } from '@/lib/constants';
import { userFiles, userSettings } from '@/lib/stores';
import { drawMirrorBleed } from '@/lib/settings-helpers';
import { addCropMarks } from './crop-marks';

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

export function getFileURL(file: File) {
	return URL.createObjectURL(file);
}

export async function getFileType(file: File) {
	const buffers = await readBufferHeader(file);
	const uint8Array = new Uint8Array(buffers);
	let fileExt = "pdf";

	if (isPNG(uint8Array)) fileExt = 'png';
	if (isJPEG(uint8Array)) fileExt = 'jpeg';

	return fileExt;
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

function needsRotation(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const mediaBoxSize = page.getMediaBox();
	const mediaBoxRatio = mediaBoxSize.width / mediaBoxSize.height;
	const embedRatio = embedFile.width / embedFile.height;

	return ((embedRatio > 1 && mediaBoxRatio < 1) || (embedRatio < 1 && mediaBoxRatio > 1));
}

function setDocument(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const { document, cropMarksAndBleed, bleedSize: bleedSizeMM } = get(userSettings);
	const embedFileRatio = embedFile.width / embedFile.height;
	let { width: userWidthMM, height: userHeightMM } = document;

	if (!userWidthMM && !userHeightMM) {
		userWidthMM = embedFile.width * POINTS_TO_MM;
		userHeightMM = embedFile.height * POINTS_TO_MM;
	};

	if (!userWidthMM) userWidthMM = document.height * embedFileRatio;
	if (!userHeightMM) userHeightMM = document.width / embedFileRatio;

	let mediaBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
	let bleedBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
	let trimBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };

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

	console.log({ media: page.getMediaBox(), bleed: page.getBleedBox(), trim: page.getTrimBox() });

}

function setEmbed(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const { fit, autoRotate } = get(userSettings);
	const mediaBoxSize = page.getMediaBox();
	const trimBoxSize = page.getTrimBox();
	const embedRatio = embedFile.width / embedFile.height;

	let width = Math.min(trimBoxSize.width, trimBoxSize.height * embedRatio);
	let height = Math.min(trimBoxSize.height, trimBoxSize.width / embedRatio);
	let x = (mediaBoxSize.width - width) / 2;
	let y = (mediaBoxSize.height - height) / 2;
	let rotate = degrees(0);

	if (fit) {
		width = Math.max(trimBoxSize.width, trimBoxSize.height * embedRatio);
		height = Math.max(trimBoxSize.height, trimBoxSize.width / embedRatio);
		x = (mediaBoxSize.width - width) / 2;
		y = (mediaBoxSize.height - height) / 2;
	}

	if (autoRotate && needsRotation(embedFile, page)) {
		width = Math.min(trimBoxSize.height, trimBoxSize.width * embedRatio);
		height = Math.min(trimBoxSize.width, trimBoxSize.height / embedRatio);
		x = (mediaBoxSize.width + height) / 2;
		y = (mediaBoxSize.height - width) / 2;

		if (fit) {
			width = Math.max(trimBoxSize.height, trimBoxSize.width * embedRatio);
			height = Math.max(trimBoxSize.width, trimBoxSize.height / embedRatio);
			x = (mediaBoxSize.width + height) / 2;
			y = (mediaBoxSize.height - width) / 2;
		}

		rotate = degrees(90);
	}

	return { x, y, width, height, rotate };
}

function draw(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage, embedOptions: PDFEmbedOptions) {
	const { cropMarksAndBleed, mirrorBleed } = get(userSettings);
	const isPdf = embedFile.constructor.name.toLowerCase().includes('page');

	if (isPdf) {
		page.drawPage(embedFile as PDFEmbeddedPage, embedOptions);
	} else {
		page.drawImage(embedFile as PDFImage, embedOptions);
	}

	if (cropMarksAndBleed) {
		if (mirrorBleed) {
			drawMirrorBleed(page, embedFile, embedOptions);
		}

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
			draw(embedFile, page, embedOptions);
		});
	},

	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const embedFile = await pdfDoc.embedJpg(file);
		const page = pdfDoc.addPage();

		setDocument(embedFile, page);
		const embedProps = setEmbed(embedFile, page);
		draw(embedFile, page, embedProps);
	},

	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const embedFile = await pdfDoc.embedPng(file);
		const page = pdfDoc.addPage();

		setDocument(embedFile, page);
		const embedProps = setEmbed(embedFile, page);
		draw(embedFile, page, embedProps);
	},

	/* async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedJpg(file);
		const page = pdfDoc.addPage();
		await applyUserSettings(page, settings, image);

		if (settings.cropMarksAndBleed) {
			const bleedBox = page.getBleedBox();
			cropMask(page, bleedBox);
		}

		const embedSizeAndPosition = getEmbedSizeAndPosition(image, page);
		page.drawImage(image, embedSizeAndPosition);
		const rotate = needsRotation(page, image, settings);

		if (settings.mirrorBleed) applyMirroBleed(image, page);

		if (settings.cropMarksAndBleed) {
			closeCropMask(page);
			addCropMarks(page);
		}

		if (rotate) page.setRotation(degrees(90));
	},*/

	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedPng(file);
		const page = pdfDoc.addPage();
		await applyUserSettings(page, settings, image);

		if (settings.cropMarksAndBleed) {
			const bleedBox = page.getBleedBox();
			cropMask(page, bleedBox);
		}

		const embedSizeAndPosition = getEmbedSizeAndPosition(image, page);
		page.drawImage(image, embedSizeAndPosition);
		const rotate = needsRotation(page, image, settings);

		if (settings.mirrorBleed) applyMirroBleed(image, page);

		if (settings.cropMarksAndBleed) {
			closeCropMask(page);
			addCropMarks(page);
		}

		if (rotate) page.setRotation(degrees(90));
	}
};
