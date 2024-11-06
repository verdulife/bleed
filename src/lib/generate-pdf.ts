import type { BleedSettings, PDFOptions, RepeatSettings } from '@/lib/types';
import { PDFDocument } from 'pdf-lib';
import { get } from 'svelte/store';
import { bleedSettings, userFiles, previewBlobUri, repeatSettings } from '@/lib/stores';
import { fileHandler, fileRepeat } from '@/lib/file-helpers';
import { toPT } from '@/lib/constants';
import { closeCropMask, openCropMask } from '@/lib/pdf-extend';

export function generateTitle(settings: BleedSettings | RepeatSettings) {
	if ('document' in settings) {
		return `${settings.document.width || "Prop"} × ${settings.document.height || "Prop"} mm`;
	} else {
		return `${settings.artboard.width || "Prop"} × ${settings.artboard.height || "Prop"} mm`;
	}
}

export async function generatePDF() {
	const settings = get(bleedSettings);
	const files = get(userFiles);

	if (files.length === 0) return;

	const pdfDoc = await PDFDocument.create();
	pdfDoc.setTitle(generateTitle(settings));
	pdfDoc.setAuthor('Bleed');


	for (const file of files) {
		const { fileType, fileBuffer } = file;
		await fileHandler[fileType](pdfDoc, fileBuffer);
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

export async function repeatPDF() {
	const settings = get(repeatSettings);
	const files = get(userFiles);

	if (files.length === 0) return;

	const pdfDoc = await PDFDocument.create();
	const artboardSize: [number, number] = [toPT(settings.artboard.width), toPT(settings.artboard.height)];

	pdfDoc.setTitle(generateTitle(settings));
	pdfDoc.setAuthor('Bleed');

	const page = pdfDoc.addPage(artboardSize);

	for (const file of files) {
		const { fileBuffer } = file;
		await fileRepeat(pdfDoc, fileBuffer, page);
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
