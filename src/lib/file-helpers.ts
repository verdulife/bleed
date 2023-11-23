import type { UserSettings } from './types';
import { PDFDocument } from 'pdf-lib';
import { FILE_TYPE } from './constants';
import {
	applyUserSettings,
	getEmbedPageScaleAndPosition,
	getImagePosition,
	getImageSize
} from './settings-helpers';
import { addCropMarks } from './crop-marks';

export function getFileURL(file: File) {
	return URL.createObjectURL(file);
}

export function getFileType(file: File) {
	const fileType = file.type.split('/')[1];
	switch (fileType) {
		case 'jpeg':
		case 'png':
			return fileType;
		default:
			return 'pdf';
	}
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

export const fileHandlers = {
	async [FILE_TYPE.PDF](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const existingPdfDoc = await PDFDocument.load(file);
		const embedPages = await pdfDoc.embedPages(existingPdfDoc.getPages());

		embedPages.forEach(async (embedPage) => {
			const page = pdfDoc.addPage();

			await applyUserSettings(page, settings);

			const trimSize = page.getTrimBox();
			const scaleAndPosition = await getEmbedPageScaleAndPosition(embedPage, trimSize);

			page.drawPage(embedPage, scaleAndPosition);
			if (settings.cropMarksAndBleed) addCropMarks(page);
		});
	},

	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedJpg(file);
		const page = pdfDoc.addPage();

		await applyUserSettings(page, settings);

		const imageSize = getImageSize(image, page);
		const imagePosition = getImagePosition(imageSize, page);

		page.drawImage(image, imagePosition);
		if (settings.cropMarksAndBleed) addCropMarks(page);
	},

	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedPng(file);
		const page = pdfDoc.addPage();

		await applyUserSettings(page, settings);

		const imageSize = getImageSize(image, page);
		const imagePosition = getImagePosition(imageSize, page);

		page.drawImage(image, imagePosition);
		if (settings.cropMarksAndBleed) addCropMarks(page);
	}
};
