import {
	type PDFPage,
	pushGraphicsState,
	popGraphicsState,
	moveTo,
	lineTo,
	closePath,
	clip,
	endPath,
} from 'pdf-lib';
import type { PDFOptions } from './types';

export function openCropMask(page: PDFPage) {
	const bleedBoxSize = page.getBleedBox();

	page.pushOperators(
		pushGraphicsState(),
		moveTo(bleedBoxSize.x, bleedBoxSize.y),
		lineTo(bleedBoxSize.x + bleedBoxSize.width, bleedBoxSize.y),
		lineTo(bleedBoxSize.x + bleedBoxSize.width, bleedBoxSize.y + bleedBoxSize.height),
		lineTo(bleedBoxSize.x, bleedBoxSize.y + bleedBoxSize.height),
		closePath(),
		clip(),
		endPath()
	);
}

export function openMask(page: PDFPage, { x, y, width, height }: PDFOptions) {
	page.pushOperators(
		pushGraphicsState(),
		moveTo(x, y),
		lineTo(x + width, y),
		lineTo(x + width, y + height),
		lineTo(x, y + height),
		closePath(),
		clip(),
		endPath()
	);
}

export function closeCropMask(page: PDFPage) {
	page.pushOperators(popGraphicsState());
}

export function closeMask(page: PDFPage) {
	page.pushOperators(popGraphicsState());
}
