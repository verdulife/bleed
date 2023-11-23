import { PDFDocument } from 'pdf-lib';
import { get } from 'svelte/store';
import { userSettings, userFiles, previewBlobUri } from '@/lib/stores';
import { fileHandlers } from './file-helpers';

export async function generatePDF() {
	const settings = get(userSettings);
	const files = get(userFiles);

	const pdfDoc = await PDFDocument.create();

	for (const file of files) {
		const { fileType, fileBuffer } = file;

		if (fileHandlers[fileType]) {
			await fileHandlers[fileType](pdfDoc, fileBuffer, settings);
		}
	}

	const pdfBytes = await pdfDoc.save();
	const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
	const blobUri = URL.createObjectURL(pdfBlob);

	previewBlobUri.set(blobUri);
}
