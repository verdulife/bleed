import type { UserSettings } from '@/lib/types';
import { degrees, PDFDocument, PDFEmbeddedPage, PDFImage, PDFPage } from 'pdf-lib';
import { FILE_TYPE, isJPEG, isPNG } from '@/lib/constants';
import { addCropMarks } from '@/lib/crop-marks';
import { closeCropMask, cropMask } from '@/lib/pdf-extend';
import { applyUserSettings, getEmbedSizeAndPosition, applyMirroBleed } from '@/lib/settings-helpers';
import { userFiles } from '@/lib/stores';

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
	if (!buffers) return;

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

export function needsRotation(page: PDFPage, file: PDFEmbeddedPage | PDFImage, settings: UserSettings) {
	const trimSize = page.getTrimBox();
	const pageAspectRatio = trimSize.width / trimSize.height;
	const embedAspectRatio = file.width / file.height;
	return settings.autoRotate && ((embedAspectRatio > 1 && pageAspectRatio < 1) || (embedAspectRatio < 1 && pageAspectRatio > 1));
}

export const fileHandlers = {
	async [FILE_TYPE.PDF](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const existingPdfDoc = await PDFDocument.load(file);
		const embedPages = await pdfDoc.embedPages(existingPdfDoc.getPages());

		embedPages.forEach(async (embedPage) => {
			const page = pdfDoc.addPage();
			await applyUserSettings(page, settings, embedPage);

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

			if (rotate) page.setRotation(degrees(90));
		});
	},

	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
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
	}
};
