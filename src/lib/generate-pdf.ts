import type { BleedSettings, RenderInfo } from '@/lib/types';
import { PDFDocument } from 'pdf-lib';
import { get } from 'svelte/store';
import { bleedSettings, userFiles, previewBlobUri, generationErrors, renderInfo } from '@/lib/stores';
import { SIZE_PRESETS, toMM } from '@/lib/constants';
import { addBlankPage, fileHandler } from '@/lib/file-helpers';

export function generateTitle(settings: BleedSettings) {
	return `${settings.document.width || "Prop"} × ${settings.document.height || "Prop"} mm`;
}

/**
 * The geometry of the document that was just produced, in millimetres, read from page 1 of
 * the generated document: the trim box is the artwork the user asked for, the media box is
 * the page as it was written (with the crop marks) and the bleed box is the bleed area.
 * Reading the boxes back is what lets the UI announce an axis the app derived from the
 * artwork aspect ratio: the value comes from the produced file, not from the settings.
 */
function readRenderInfo(pdfDoc: PDFDocument): RenderInfo {
	const page = pdfDoc.getPage(0);
	const mediaBox = page.getMediaBox();
	const trimBox = page.getTrimBox();
	const bleedBox = page.getBleedBox();

	return {
		artwork: { width: toMM(trimBox.width), height: toMM(trimBox.height) },
		media: { width: toMM(mediaBox.width), height: toMM(mediaBox.height) },
		bleed: { width: toMM(bleedBox.width), height: toMM(bleedBox.height) },
		pageCount: pdfDoc.getPageCount()
	};
}

export async function generatePDF() {
	const settings = get(bleedSettings);
	const files = get(userFiles);

	// Every run starts from a clean slate: the notice only ever shows this run's failures, and
	// the panel only ever shows the sizes of this run's document (a failed run publishes none).
	generationErrors.set([]);
	renderInfo.set(null);

	const pdfDoc = await PDFDocument.create();
	pdfDoc.setTitle(generateTitle(settings));
	pdfDoc.setAuthor('Bleed');

	const failures: string[] = [];

	if (files.length === 0) {
		// No files is not a failure: it is a request for a blank template that honours the
		// current settings, so this run produces exactly one artwork-less page with the usual
		// prepress geometry and crop marks - the same primitive the PDF handler uses for a
		// blank source page. With no artwork there is no aspect ratio to derive a missing axis
		// from, so an empty axis falls back to the A4 preset, independently per axis: this is
		// the one place where the app invents a size.
		const fallback = SIZE_PRESETS.A4;

		addBlankPage(
			pdfDoc,
			settings.document.width || fallback.width,
			settings.document.height || fallback.height
		);
	}

	// A no-op for the template run above: with no files there is nothing to process.
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
	// no explanation. Report it and publish nothing. This stays the counterpart of the
	// template above, which always adds a page: "no files" is an intentional blank output,
	// "files that produced no page" is a reported failure that publishes nothing.
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
		// The save succeeded, so the boxes are the ones the user actually received. Full
		// precision is kept here; rounding is the panel's job.
		renderInfo.set(readRenderInfo(pdfDoc));
	} catch (error) {
		console.error('Error generating PDF:', error);
		failures.push('Could not generate the PDF');
	} finally {
		generationErrors.set(failures);
	}
}
