import type {
	PDFPage,
	PDFImage,
	PDFEmbeddedPage,
	PDFPageDrawPageOptions,
	PDFPageDrawImageOptions
} from 'pdf-lib';
import type { PDFEmbedOptions } from '@/lib/types';

export function drawMirrorBleed(page: PDFPage, embedFile: PDFEmbeddedPage | PDFImage, embedOptions: PDFEmbedOptions) {
	const isPdf = embedFile.constructor.name.toLowerCase().includes('page');

	function drawMirrorSide(options: PDFPageDrawPageOptions | PDFPageDrawImageOptions) {
		if (isPdf) page.drawPage(embedFile as PDFEmbeddedPage, options);
		else page.drawImage(embedFile as PDFImage, options);
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
