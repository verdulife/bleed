import type { UserSettings } from '@/lib/types';
import { PDFDocument } from 'pdf-lib';
import { get } from 'svelte/store';
import { userSettings, userFiles, previewBlobUri } from '@/lib/stores';
import { fileHandlers } from '@/lib/file-helpers';

export function generateTitle(settings: UserSettings) {
	return `${settings.document.width || "Prop"} × ${settings.document.height || "Prop"} mm`;
}

export async function generatePDF() {
	const settings = get(userSettings);
	const files = get(userFiles);

	if (files.length === 0) return;

	const pdfDoc = await PDFDocument.create();
	pdfDoc.setTitle(generateTitle(settings));
	pdfDoc.setAuthor('Bleed');


	for (const file of files) {
		const { fileType, fileBuffer } = file;

		if (fileHandlers[fileType]) {
			await fileHandlers[fileType](pdfDoc, fileBuffer, settings);
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
