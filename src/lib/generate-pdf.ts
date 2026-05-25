import type { BleedSettings, PDFOptions, RepeatSettings } from '@/lib/types';
import { PDFDocument } from 'pdf-lib';
import { get } from 'svelte/store';
import { bleedSettings, userFiles, previewBlobUri, repeatSettings } from '@/lib/stores';
import { fileHandler, fileRepeat, calculateGrid, drawElement, embedFileOnPage, SAFETY_MARGIN_MM } from '@/lib/file-helpers';
import { toPT } from '@/lib/constants';
import { closeCropMask, openCropMask } from '@/lib/pdf-extend';
import { drawOuterCropMarks } from '@/lib/crop-marks';

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

export async function repeatPDF() {
	const settings = get(repeatSettings);
	const { bleedSize } = get(bleedSettings);
	const files = get(userFiles);

	if (files.length === 0) return;

	const pdfDoc = await PDFDocument.create();
	pdfDoc.setTitle(generateTitle(settings));
	pdfDoc.setAuthor('Bleed');

	const embedWidthMM = settings.embed.width || 50;
	const embedHeightMM = settings.embed.height || 50;

	const grid = calculateGrid(
		settings.artboard.width,
		settings.artboard.height,
		embedWidthMM,
		embedHeightMM,
		settings.gapX,
		settings.gapY,
		files.length
	);
	console.log('Grid calculation:', grid);

	if (grid.columns === 0 || grid.rows === 0) {
		alert('Element too large to fit in artboard with current gap settings.');
		return;
	}

	const embeddedPages: Array<{ type: 'page' | 'image'; data: any }> = [];

	for (const file of files) {
		try {
			if (file.fileType === 'pdf') {
				const loadedFiles = await PDFDocument.load(file.fileBuffer, { ignoreEncryption: true });
				const pages = await pdfDoc.embedPages(loadedFiles.getPages());
				pages.forEach(p => embeddedPages.push({ type: 'page', data: p }));
			} else if (file.fileType === 'jpeg') {
				const img = await pdfDoc.embedJpg(file.fileBuffer);
				embeddedPages.push({ type: 'image', data: img });
			} else {
				const img = await pdfDoc.embedPng(file.fileBuffer);
				embeddedPages.push({ type: 'image', data: img });
			}
		} catch (error) {
			console.error(`Error embedding "${file.fileName}":`, error);
		}
	}

	if (embeddedPages.length === 0) return;

	const elementsPerPage = grid.columns * grid.rows;

	const artboardSize: [number, number] = [toPT(settings.artboard.width), toPT(settings.artboard.height)];

	let elementIndex = 0;
	let pageIndex = 0;
	const page = pdfDoc.addPage(artboardSize);

	for (let row = grid.rows - 1; row >= 0; row--) {
		for (let col = 0; col < grid.columns; col++) {
			const element = embeddedPages[elementIndex % embeddedPages.length];

			drawElement(
				page,
				element.data,
				{ col, row, totalCols: grid.columns, totalRows: grid.rows },
				grid.elementWidth,
				grid.elementHeight,
				settings.gapX,
				settings.gapY,
				bleedSize,
				grid.rotation,
				settings.artboard.width,
				settings.artboard.height
			);

			elementIndex++;
			pageIndex++;

			if (pageIndex >= elementsPerPage && elementIndex < elementsPerPage) {
				break;
			}
		}
	}

	// Draw outer crop marks
	const safetyPt = toPT(SAFETY_MARGIN_MM);
	const elementW = toPT(grid.elementWidth);
	const elementH = toPT(grid.elementHeight);
	const gapX = toPT(settings.gapX);
	const gapY = toPT(settings.gapY);
	const usableWidth = toPT(settings.artboard.width - SAFETY_MARGIN_MM * 2);
	const usableHeight = toPT(settings.artboard.height - SAFETY_MARGIN_MM * 2);
	const gridWidth = grid.columns * elementW + (grid.columns - 1) * gapX;
	const gridHeight = grid.rows * elementH + (grid.rows - 1) * gapY;
	const offsetX = Math.max(0, (usableWidth - gridWidth) / 2);
	const offsetY = Math.max(0, (usableHeight - gridHeight) / 2);
	const gridStartX = safetyPt + offsetX;
	const gridStartY = safetyPt + offsetY;

	// PDF coords: Y=0 at bottom, so grid top in PDF = pageHeight - gridStartY - gridHeight
	const pageHeight = artboardSize[1];
	const gridPdfX = gridStartX;
	const gridPdfY = pageHeight - gridStartY - gridHeight;

	drawOuterCropMarks(page, gridPdfX, gridPdfY, gridWidth, gridHeight);

	try {
		const pdfBytes = await pdfDoc.save();
		const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
		const blobUri = URL.createObjectURL(pdfBlob);
		previewBlobUri.set(blobUri);
	} catch (error) {
		alert('Error generating PDF');
	}
}
