import type { BleedSettings } from '@/lib/types';
import { PDFDocument } from 'pdf-lib';
import { get } from 'svelte/store';
import { bleedSettings, userFiles, previewBlobUri, generationErrors } from '@/lib/stores';
import { fileHandler } from '@/lib/file-helpers';

export function generateTitle(settings: BleedSettings) {
	return `${settings.document.width || "Prop"} × ${settings.document.height || "Prop"} mm`;
}

export async function generatePDF() {
	const settings = get(bleedSettings);
	const files = get(userFiles);

	// Every run starts from a clean slate: the notice only ever shows this run's failures.
	generationErrors.set([]);

	if (files.length === 0) return;

	const pdfDoc = await PDFDocument.create();
	pdfDoc.setTitle(generateTitle(settings));
	pdfDoc.setAuthor('Bleed');

	const failures: string[] = [];

	for (const file of files) {
		try {
			const { fileType, fileBuffer } = file;
			await fileHandler[fileType](pdfDoc, fileBuffer);
		} catch (error) {
			console.error(`Error processing "${file.fileName}":`, error);
			failures.push(`Could not process "${file.fileName}"`);
		}
	}

	// Files were provided but nothing reached the document: `save()` would otherwise add a
	// default A4 page (`addDefaultPage: true`), so the user would download a blank sheet with
	// no explanation. Report it and publish nothing. This is deliberately *not* the empty-list
	// case above, which returns before the document is even created.
	if (pdfDoc.getPageCount() === 0) {
		failures.push('No pages were generated');
		generationErrors.set(failures);
		return;
	}

	try {
		const pdfBytes = await pdfDoc.save({ addDefaultPage: false });
		const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf', });
		const blobUri = URL.createObjectURL(pdfBlob);
		previewBlobUri.set(blobUri);
	} catch (error) {
		console.error('Error generating PDF:', error);
		failures.push('Could not generate the PDF');
	} finally {
		generationErrors.set(failures);
	}
}
