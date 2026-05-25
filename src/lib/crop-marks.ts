import { type PDFPage, cmyk } from 'pdf-lib';
import { CROPLINE, MM_TO_POINTS, toPT } from '@/lib/constants';

export function addCropMarks(page: PDFPage) {
	const width = page.getWidth();
	const height = page.getHeight();
	const lineSize = CROPLINE.SIZE * MM_TO_POINTS;
	const lineDistance = CROPLINE.DISTANCE * MM_TO_POINTS;

	//bottom left
	page.drawLine({
		start: { x: 0, y: lineDistance },
		end: { x: lineSize, y: lineDistance },
		thickness: 0.75,
		color: cmyk(0, 0, 0, 0)
	});
	page.drawLine({
		start: { x: 0, y: lineDistance },
		end: { x: lineSize, y: lineDistance },
		thickness: 0.25
	});
	page.drawLine({
		start: { x: lineDistance, y: 0 },
		end: { x: lineDistance, y: lineSize },
		thickness: 0.75,
		color: cmyk(0, 0, 0, 0)
	});
	page.drawLine({
		start: { x: lineDistance, y: 0 },
		end: { x: lineDistance, y: lineSize },
		thickness: 0.25
	});

	//bottom right
	page.drawLine({
		start: { x: width, y: lineDistance },
		end: { x: width - lineSize, y: lineDistance },
		thickness: 0.75,
		color: cmyk(0, 0, 0, 0)
	});
	page.drawLine({
		start: { x: width, y: lineDistance },
		end: { x: width - lineSize, y: lineDistance },
		thickness: 0.25
	});
	page.drawLine({
		start: { x: width - lineDistance, y: 0 },
		end: { x: width - lineDistance, y: lineSize },
		thickness: 0.75,
		color: cmyk(0, 0, 0, 0)
	});
	page.drawLine({
		start: { x: width - lineDistance, y: 0 },
		end: { x: width - lineDistance, y: lineSize },
		thickness: 0.25
	});

	//top left
	page.drawLine({
		start: { x: 0, y: height - lineDistance },
		end: { x: lineSize, y: height - lineDistance },
		thickness: 0.75,
		color: cmyk(0, 0, 0, 0)
	});
	page.drawLine({
		start: { x: 0, y: height - lineDistance },
		end: { x: lineSize, y: height - lineDistance },
		thickness: 0.25
	});
	page.drawLine({
		start: { x: lineDistance, y: height },
		end: { x: lineDistance, y: height - lineSize },
		thickness: 0.75,
		color: cmyk(0, 0, 0, 0)
	});
	page.drawLine({
		start: { x: lineDistance, y: height },
		end: { x: lineDistance, y: height - lineSize },
		thickness: 0.25
	});

	//top right
	page.drawLine({
		start: { x: width, y: height - lineDistance },
		end: { x: width - lineSize, y: height - lineDistance },
		thickness: 0.75,
		color: cmyk(0, 0, 0, 0)
	});
	page.drawLine({
		start: { x: width, y: height - lineDistance },
		end: { x: width - lineSize, y: height - lineDistance },
		thickness: 0.25
	});
	page.drawLine({
		start: { x: width - lineDistance, y: height },
		end: { x: width - lineDistance, y: height - lineSize },
		thickness: 0.75,
		color: cmyk(0, 0, 0, 0)
	});
	page.drawLine({
		start: { x: width - lineDistance, y: height },
		end: { x: width - lineDistance, y: height - lineSize },
		thickness: 0.25
	});
}

export function drawOuterCropMarks(
	page: PDFPage,
	gridX: number,
	gridY: number,
	gridWidth: number,
	gridHeight: number
) {
	const lineSize = CROPLINE.SIZE * MM_TO_POINTS;
	const lineDistance = CROPLINE.DISTANCE * MM_TO_POINTS;

	const x1 = gridX;
	const y1 = gridY;
	const x2 = gridX + gridWidth;
	const y2 = gridY + gridHeight;

	// bottom-left corner (x1, y1)
	page.drawLine({ start: { x: x1, y: y1 + lineDistance }, end: { x: x1 + lineSize, y: y1 + lineDistance }, thickness: 0.75, color: cmyk(0, 0, 0, 0) });
	page.drawLine({ start: { x: x1, y: y1 + lineDistance }, end: { x: x1 + lineSize, y: y1 + lineDistance }, thickness: 0.25 });
	page.drawLine({ start: { x: x1 + lineDistance, y: y1 }, end: { x: x1 + lineDistance, y: y1 + lineSize }, thickness: 0.75, color: cmyk(0, 0, 0, 0) });
	page.drawLine({ start: { x: x1 + lineDistance, y: y1 }, end: { x: x1 + lineDistance, y: y1 + lineSize }, thickness: 0.25 });

	// bottom-right corner (x2, y1)
	page.drawLine({ start: { x: x2, y: y1 + lineDistance }, end: { x: x2 - lineSize, y: y1 + lineDistance }, thickness: 0.75, color: cmyk(0, 0, 0, 0) });
	page.drawLine({ start: { x: x2, y: y1 + lineDistance }, end: { x: x2 - lineSize, y: y1 + lineDistance }, thickness: 0.25 });
	page.drawLine({ start: { x: x2 - lineDistance, y: y1 }, end: { x: x2 - lineDistance, y: y1 + lineSize }, thickness: 0.75, color: cmyk(0, 0, 0, 0) });
	page.drawLine({ start: { x: x2 - lineDistance, y: y1 }, end: { x: x2 - lineDistance, y: y1 + lineSize }, thickness: 0.25 });

	// top-left corner (x1, y2)
	page.drawLine({ start: { x: x1, y: y2 - lineDistance }, end: { x: x1 + lineSize, y: y2 - lineDistance }, thickness: 0.75, color: cmyk(0, 0, 0, 0) });
	page.drawLine({ start: { x: x1, y: y2 - lineDistance }, end: { x: x1 + lineSize, y: y2 - lineDistance }, thickness: 0.25 });
	page.drawLine({ start: { x: x1 + lineDistance, y: y2 }, end: { x: x1 + lineDistance, y: y2 - lineSize }, thickness: 0.75, color: cmyk(0, 0, 0, 0) });
	page.drawLine({ start: { x: x1 + lineDistance, y: y2 }, end: { x: x1 + lineDistance, y: y2 - lineSize }, thickness: 0.25 });

	// top-right corner (x2, y2)
	page.drawLine({ start: { x: x2, y: y2 - lineDistance }, end: { x: x2 - lineSize, y: y2 - lineDistance }, thickness: 0.75, color: cmyk(0, 0, 0, 0) });
	page.drawLine({ start: { x: x2, y: y2 - lineDistance }, end: { x: x2 - lineSize, y: y2 - lineDistance }, thickness: 0.25 });
	page.drawLine({ start: { x: x2 - lineDistance, y: y2 }, end: { x: x2 - lineDistance, y: y2 - lineSize }, thickness: 0.75, color: cmyk(0, 0, 0, 0) });
	page.drawLine({ start: { x: x2 - lineDistance, y: y2 }, end: { x: x2 - lineDistance, y: y2 - lineSize }, thickness: 0.25 });
}
