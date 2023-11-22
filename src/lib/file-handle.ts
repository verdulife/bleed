import { PDFDocument } from 'pdf-lib';
import { applyUserSettings } from './utils';
import type { UserSettings } from './types';

const FILE_TYPE = {
	PDF: 'pdf',
	JPEG: 'jpeg',
	PNG: 'png'
};

export const fileHandlers = {
	async [FILE_TYPE.PDF](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const existingPdfDoc = await PDFDocument.load(file);
		const pages = await pdfDoc.copyPages(existingPdfDoc, existingPdfDoc.getPageIndices());

		pages.forEach((page) => {
			applyUserSettings(page, settings);
			pdfDoc.addPage(page);
		});
	},
	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedJpg(file);
		const page = pdfDoc.addPage();
		const { width, height } = page.getSize();

		applyUserSettings(page, settings);
		page.drawImage(image, { x: 0, y: 0, width, height });
	},
	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedPng(file);
		const page = pdfDoc.addPage();
		const { width, height } = page.getSize();

		applyUserSettings(page, settings);
		page.drawImage(image, { x: 0, y: 0, width, height });
	}
};
