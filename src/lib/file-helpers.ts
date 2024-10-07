import { degrees, PDFDocument, PDFEmbeddedPage, PDFImage, PDFPage } from 'pdf-lib';
import { CROPLINE, FILE_TYPE, isJPEG, isPNG, POINTS_TO_MM, toPT } from '@/lib/constants';
import { userFiles, userSettings } from '@/lib/stores';
import { get } from 'svelte/store';

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
			width: toPT(CROPLINE.DISTANCE * 2 + userWidthMM),
			height: toPT(CROPLINE.DISTANCE * 2 + userHeightMM)
		}

		bleedBoxSize = {
			x: cropMarkSizeMM,
			y: cropMarkSizeMM,
			width: bleedSizeMM * 2 + mediaBoxSize.width,
			height: bleedSizeMM * 2 + mediaBoxSize.height
		}

		trimBoxSize = {
			x: toPT(bleedSizeMM + cropMarkSizeMM),
			y: toPT(bleedSizeMM + cropMarkSizeMM),
			width: toPT(mediaBoxSize.width - bleedSizeMM * 2 - cropMarkSizeMM * 2),
			height: toPT(mediaBoxSize.height - bleedSizeMM * 2 - cropMarkSizeMM * 2)
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
}

function setEmbed(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const { fit, autoRotate } = get(userSettings);
	const mediaBoxSize = page.getMediaBox();
	const embedRatio = embedFile.width / embedFile.height;

	let rotate = degrees(0);
	let width = Math.min(mediaBoxSize.width, mediaBoxSize.height * embedRatio);
	let height = Math.min(mediaBoxSize.height, mediaBoxSize.width / embedRatio);
	let x = (mediaBoxSize.width - width) / 2;
	let y = (mediaBoxSize.height - height) / 2;

	if (fit) {
		width = Math.max(mediaBoxSize.width, mediaBoxSize.height * embedRatio);
		height = Math.max(mediaBoxSize.height, mediaBoxSize.width / embedRatio);
		x = (mediaBoxSize.width - width) / 2;
		y = (mediaBoxSize.height - height) / 2;
	}

	if (autoRotate && needsRotation(embedFile, page)) {
		width = Math.min(mediaBoxSize.height, mediaBoxSize.width * embedRatio);
		height = Math.min(mediaBoxSize.width, mediaBoxSize.height / embedRatio);
		x = (mediaBoxSize.width + height) / 2;
		y = (mediaBoxSize.height - width) / 2;

		if (fit) {
			width = Math.max(mediaBoxSize.height, mediaBoxSize.width * embedRatio);
			height = Math.max(mediaBoxSize.width, mediaBoxSize.height / embedRatio);
			x = (mediaBoxSize.width + height) / 2;
			y = (mediaBoxSize.height - width) / 2;
		}

		rotate = degrees(90);
	}

	return { x, y, width, height, rotate };
}

export const fileHandler = {
	async [FILE_TYPE.PDF](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const loadedFiles = await PDFDocument.load(file);
		const embedPages = await pdfDoc.embedPages(loadedFiles.getPages());

		embedPages.forEach(async (embedFile) => {
			const page = pdfDoc.addPage();

			setDocument(embedFile, page);
			const embedProps = setEmbed(embedFile, page);
			page.drawPage(embedFile, embedProps);

			/* await applyUserSettings(page, settings, embedPage);
	
			if (settings.cropMarksAndBleed) {
				const bleedBox = page.getBleedBox();
				cropMask(page, bleedBox);
			}
	
			const embedSizeAndPosition = getEmbedSizeAndPosition(embedPage, page);
			page.drawPage(embedPage, embedSizeAndPosition);
			const rotate = needsRotation(page, embedPage, settings);
	
			if (settings.mirrorBleed) applyMirroBleed(embedPage, page);
	
			if (settings.cropMarksAndBleed) {
				closeCropMask(page);
				addCropMarks(page);
			}
	
			if (rotate) page.setRotation(degrees(90)); */
		});
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
	},

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
	} */
};
