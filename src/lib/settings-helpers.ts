import type {
	PDFPage,
	PDFImage,
	PDFEmbeddedPage,
	PDFPageDrawPageOptions,
	PDFPageDrawImageOptions
} from 'pdf-lib';
import type { PDFEmbedOptions } from './types';

export function drawMirrorBleed(page: PDFPage, embedFile: PDFEmbeddedPage | PDFImage, embedOptions: PDFEmbedOptions) {
	const isPdf = embedFile.constructor.name.toLowerCase().includes('page');
	const mediaBoxSize = page.getBleedBox();

	function drawMirrorSide(options: PDFPageDrawPageOptions | PDFPageDrawImageOptions) {
		if (isPdf) page.drawPage(embedFile as PDFEmbeddedPage, options);
		else page.drawImage(embedFile as PDFImage, options);
	}

	//top-left
	drawMirrorSide({
		x: mediaBoxSize.width / 2 - embedOptions.width / 2,
		y: mediaBoxSize.height / 2 - embedOptions.height / 2 + embedOptions.height * 2,
		width: -embedOptions.width,
		height: -embedOptions.height
	});

	//center-left
	drawMirrorSide({
		x: mediaBoxSize.width / 2 - embedOptions.width / 2,
		y: mediaBoxSize.height / 2 - embedOptions.height / 2,
		width: -embedOptions.width,
		height: embedOptions.height
	});

	//bottom-left
	drawMirrorSide({
		x: mediaBoxSize.width / 2 - embedOptions.width / 2,
		y: mediaBoxSize.height / 2 - embedOptions.height / 2,
		width: -embedOptions.width,
		height: -embedOptions.height
	});

	//top-center
	drawMirrorSide({
		x: mediaBoxSize.width / 2 - embedOptions.width / 2,
		y: mediaBoxSize.height / 2 - embedOptions.height / 2 + embedOptions.height * 2,
		width: embedOptions.width,
		height: -embedOptions.height
	});

	//bottom-center
	drawMirrorSide({
		x: mediaBoxSize.width / 2 - embedOptions.width / 2,
		y: mediaBoxSize.height / 2 - embedOptions.height / 2,
		width: embedOptions.width,
		height: -embedOptions.height
	});

	//top-right
	drawMirrorSide({
		x: mediaBoxSize.width / 2 - embedOptions.width / 2 + embedOptions.width * 2,
		y: mediaBoxSize.height / 2 - embedOptions.height / 2 + embedOptions.height * 2,
		width: -embedOptions.width,
		height: -embedOptions.height
	});

	//center-right
	drawMirrorSide({
		x: mediaBoxSize.width / 2 - embedOptions.width / 2 + embedOptions.width * 2,
		y: mediaBoxSize.height / 2 - embedOptions.height / 2,
		width: -embedOptions.width,
		height: embedOptions.height
	});

	//bottom-right
	drawMirrorSide({
		x: mediaBoxSize.width / 2 - embedOptions.width / 2 + embedOptions.width * 2,
		y: mediaBoxSize.height / 2 - embedOptions.height / 2,
		width: -embedOptions.width,
		height: -embedOptions.height
	});
}
