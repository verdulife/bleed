import type { BleedSettings } from '@/lib/types';
import { PDFDocument } from 'pdf-lib';
import { get } from 'svelte/store';
import { bleedSettings, userFiles, previewBlobUri } from '@/lib/stores';
import { fileHandler } from '@/lib/file-helpers';

export function generateTitle(settings: BleedSettings) {
	return `${settings.document.width || "Prop"} × ${settings.document.height || "Prop"} mm`;
}

export async function generatePDF() {
	const settings = get(bleedSettings);
	const files = get(userFiles);

	if (files.length === 0) return;

	const pdfDoc = await PDFDocument.create();
	pdfDoc.setTitle(generateTitle(settings));
	pdfDoc.setAuthor('Bleed');


	for (const file of files) {
		try {
			const { fileType, fileBuffer } = file;
			await fileHandler[fileType](pdfDoc, fileBuffer);
		} catch (error) {
			console.error(`Error processing "${file.fileName}":`, error);
		}
	}

	try {
		const pdfBytes = await pdfDoc.save();
		const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf', });
		const blobUri = URL.createObjectURL(pdfBlob);
		previewBlobUri.set(blobUri);
	} catch (error) {
		alert('Error generating PDF');
	}
}
