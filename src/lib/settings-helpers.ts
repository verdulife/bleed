import { PDFEmbeddedPage } from 'pdf-lib';
import type {
	PDFPage,
	PDFImage,
	PDFPageDrawPageOptions,
	PDFPageDrawImageOptions
} from 'pdf-lib';
import type { PDFOptions } from '@/lib/types';

export function drawMirrorBleed(page: PDFPage, embedFile: PDFEmbeddedPage | PDFImage, embedOptions: PDFOptions) {
	function drawMirrorSide(options: PDFPageDrawPageOptions | PDFPageDrawImageOptions) {
		// Same trap as `embedFileOnPage`: `instanceof` and not a class name, because the production
		// minifier renames `PDFEmbeddedPage` and a name-based sniff would send an embedded page to
		// `drawImage` in the deployed bundle only (see the comment in `file-helpers.ts`).
		if (embedFile instanceof PDFEmbeddedPage) page.drawPage(embedFile, options);
		else page.drawImage(embedFile, options);
	}

	//top-left
	drawMirrorSide({
		x: embedOptions.x,
		y: embedOptions.y + embedOptions.height * 2,
		width: -embedOptions.width,
		height: -embedOptions.height
	});

	//center-left
	drawMirrorSide({
		x: embedOptions.x,
		y: embedOptions.y,
		width: -embedOptions.width,
		height: embedOptions.height
	});


	//bottom-left
	drawMirrorSide({
		x: embedOptions.x,
		y: embedOptions.y,
		width: -embedOptions.width,
		height: -embedOptions.height
	});

	//top-center
	drawMirrorSide({
		x: embedOptions.x,
		y: embedOptions.y + embedOptions.height * 2,
		width: embedOptions.width,
		height: -embedOptions.height
	});

	//bottom-center
	drawMirrorSide({
		x: embedOptions.x,
		y: embedOptions.y,
		width: embedOptions.width,
		height: -embedOptions.height
	});

	//top-right
	drawMirrorSide({
		x: embedOptions.x + embedOptions.width * 2,
		y: embedOptions.y + embedOptions.height * 2,
		width: -embedOptions.width,
		height: -embedOptions.height
	});

	//center-right
	drawMirrorSide({
		x: embedOptions.x + embedOptions.width * 2,
		y: embedOptions.y,
		width: -embedOptions.width,
		height: embedOptions.height
	});

	//bottom-right
	drawMirrorSide({
		x: embedOptions.x + embedOptions.width * 2,
		y: embedOptions.y,
		width: -embedOptions.width,
		height: -embedOptions.height
	});
}
