import {
	type PDFPage,
	type PDFEmbeddedPage,
	type PDFImage,
	pushGraphicsState,
	popGraphicsState,
	moveTo,
	lineTo,
	closePath,
	clip,
	endPath,
	concatTransformationMatrix
} from 'pdf-lib';
import type { PDFCropBox } from './types';

function toRadians(degree: number) {
	return degree * (Math.PI / 180);
};

export function cropMask(page: PDFPage, cropBox: PDFCropBox) {
	page.pushOperators(
		pushGraphicsState(),
		moveTo(cropBox.x, cropBox.y),
		lineTo(cropBox.x + cropBox.width, cropBox.y),
		lineTo(cropBox.x + cropBox.width, cropBox.y + cropBox.height),
		lineTo(cropBox.x, cropBox.y + cropBox.height),
		closePath(),
		clip(),
		endPath()
	);

	page.pushOperators(popGraphicsState());
}

export function rotateFromCenter(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage, rotation: number) {
	const originX = page.getWidth() / 2;
	const originY = page.getHeight() / 2;
	const angle = toRadians(rotation);
	const isPdf = embedFile.constructor.name.toLowerCase().includes('page');

	page.pushOperators(
		pushGraphicsState(),
		concatTransformationMatrix(1, 0, 0, 1, originX, originY),
		concatTransformationMatrix(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0),
		concatTransformationMatrix(1, 0, 0, 1, -1 * originX, -1 * originY),
	);

	const options = {
		x: originX - (page.getWidth() / 2),
		y: originY - (page.getHeight() / 2),
		width: page.getWidth(),
		height: page.getHeight()
	};

	if (isPdf) page.drawPage(embedFile as PDFEmbeddedPage, options);
	else page.drawImage(embedFile as PDFImage, options);

	page.pushOperators(
		popGraphicsState(),
	);
}
