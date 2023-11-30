import { PDFDocument } from 'pdf-lib';
import { get } from 'svelte/store';
import { userSettings, userFiles, previewBlobUri } from '@/lib/stores';
import { fileHandlers } from './file-helpers';
import { MM_TO_POINTS } from './constants';

export async function generatePDF() {
	const settings = get(userSettings);
	const files = get(userFiles);

	if (files.length === 0) return;

	const pdfDoc = await PDFDocument.create();

	for (const file of files) {
		const { fileType, fileBuffer } = file;

		if (fileHandlers[fileType]) {
			await fileHandlers[fileType](pdfDoc, fileBuffer, settings);
		}
	}

	if (settings.repeat) {
		const pdfBytes = await pdfDoc.save();
		const existingPdfDoc = await PDFDocument.load(pdfBytes);
		const embedPages = await pdfDoc.embedPages(existingPdfDoc.getPages());
		const { width, height } = settings.artboard;
		const widthMM = width * MM_TO_POINTS;
		const heightMM = height * MM_TO_POINTS;

		const repeatPage = pdfDoc.addPage([widthMM, heightMM]);

		for (let i = 0; i < settings.repeatX * settings.repeatY; i++) {
			embedPages.forEach(async (embedPage) => {
				repeatPage.drawPage(embedPage, {
					x: 0,
					y: 0
				});
			});
		}
	}

	const pdfBytes = await pdfDoc.save();
	const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
	const blobUri = URL.createObjectURL(pdfBlob);

	previewBlobUri.set(blobUri);
}
