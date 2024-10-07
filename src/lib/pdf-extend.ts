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

export function closeCropMask(page: PDFPage) {
	page.pushOperators(popGraphicsState());
}
