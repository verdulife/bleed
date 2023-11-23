import { PDFDocument } from 'pdf-lib';
import {
	applyUserSettings,
	getEmbedPageScaleAndPosition,
	getImagePosition,
	getImageSize
} from './utils';
import type { UserSettings } from './types';

const FILE_TYPE = {
	PDF: 'pdf',
	JPEG: 'jpeg',
	PNG: 'png'
};

export const fileHandlers = {
	async [FILE_TYPE.PDF](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const existingPdfDoc = await PDFDocument.load(file);
		const embedPages = await pdfDoc.embedPages(existingPdfDoc.getPages());

		embedPages.forEach(async (embedPage) => {
			const page = pdfDoc.addPage();
			applyUserSettings(page, settings);

			const scaleAndPosition = await getEmbedPageScaleAndPosition(embedPage, page);
			page.drawPage(embedPage, scaleAndPosition);
		});
	},

	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedJpg(file);

		const page = pdfDoc.addPage();
		applyUserSettings(page, settings);

		const pageSize = page.getSize();
		const imageSize = getImageSize(image, pageSize);
		const imagePosition = getImagePosition(imageSize, pageSize);

		page.drawImage(image, imagePosition);
	},

	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedPng(file);

		const page = pdfDoc.addPage();
		applyUserSettings(page, settings);

		const pageSize = page.getSize();
		const imageSize = getImageSize(image, pageSize);
		const imagePosition = getImagePosition(imageSize, pageSize);

		page.drawImage(image, imagePosition);
	}
};
