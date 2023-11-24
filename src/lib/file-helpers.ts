import type { UserSettings } from './types';
import { PDFDocument } from 'pdf-lib';
import { FILE_TYPE } from './constants';
import { addCropMarks } from './crop-marks';
import { closeCropMask, cropMask } from './pdf-extend';
import {
	applyUserSettings,
	getPDFScaleAndPosition,
	getImagePosition,
	applyMirroBleedPdf
} from './settings-helpers';

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
			const scaleAndPosition = getPDFScaleAndPosition(embedPage, page);

			if (settings.cropMarksAndBleed) {
				const bleedBox = page.getBleedBox();
				cropMask(page, bleedBox);
			}

			page.drawPage(embedPage, scaleAndPosition);
			if (settings.mirrorBleed) applyMirroBleedPdf(embedPage, page);

			if (settings.cropMarksAndBleed) {
				closeCropMask(page);
				addCropMarks(page);
			}
		});
	},

	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedJpg(file);
		const page = pdfDoc.addPage();
		await applyUserSettings(page, settings);
		const imagePosition = getImagePosition(image, page);

		if (settings.cropMarksAndBleed) {
			const bleedBox = page.getBleedBox();
			cropMask(page, bleedBox);
		}

		page.drawImage(image, imagePosition);
		if (settings.mirrorBleed) applyMirroBleedPdf(image, page);

		if (settings.cropMarksAndBleed) {
			closeCropMask(page);
			addCropMarks(page);
		}
	},

	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedPng(file);
		const page = pdfDoc.addPage();
		await applyUserSettings(page, settings);
		const imagePosition = getImagePosition(image, page);

		if (settings.cropMarksAndBleed) {
			const bleedBox = page.getBleedBox();
			cropMask(page, bleedBox);
		}

		page.drawImage(image, imagePosition);
		if (settings.mirrorBleed) applyMirroBleedPdf(image, page);

		if (settings.cropMarksAndBleed) {
			closeCropMask(page);
			addCropMarks(page);
		}
	}
};
