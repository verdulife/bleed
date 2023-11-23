import { type PDFPage, rgb } from 'pdf-lib';
import { CROPLINE, MM_TO_POINTS } from './constants';

export function addCropMarks(page: PDFPage) {
	const width = page.getWidth();
	const height = page.getHeight();
	const lineSizeMM = CROPLINE.SIZE * MM_TO_POINTS;
	const lineDistanceMM = CROPLINE.DISTANCE * MM_TO_POINTS;

	const corners = [
		{ x: 0, y: lineDistanceMM },
		{ x: width, y: lineDistanceMM },
		{ x: 0, y: height - lineDistanceMM },
		{ x: width, y: height - lineDistanceMM }
	];

	corners.forEach((corner) => {
		// Vertical lines
		page.drawLine({
			start: { x: corner.x, y: corner.y },
			end: { x: corner.x, y: corner.y + lineSizeMM },
			thickness: 0.75,
			color: rgb(1, 1, 1)
		});

		page.drawLine({
			start: { x: corner.x, y: corner.y },
			end: { x: corner.x, y: corner.y + lineSizeMM },
			thickness: 0.25
		});

		// Horizontal lines
		page.drawLine({
			start: { x: corner.x, y: corner.y },
			end: { x: corner.x + lineSizeMM, y: corner.y },
			thickness: 0.75,
			color: rgb(1, 1, 1)
		});

		page.drawLine({
			start: { x: corner.x, y: corner.y },
			end: { x: corner.x + lineSizeMM, y: corner.y },
			thickness: 0.25
		});
	});
}
