import {
	PDFPage,
	pushGraphicsState,
	popGraphicsState,
	moveTo,
	lineTo,
	closePath,
	clip,
	endPath
} from 'pdf-lib';
import type { PDFCropBox } from './types';

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
}

export function closeCropMask(page: PDFPage) {
	page.pushOperators(popGraphicsState());
}
