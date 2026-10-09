import { type PDFPage, cmyk } from 'pdf-lib';
import { CROPLINE, MM_TO_POINTS } from '@/lib/constants';

/**
 * Draws the four mark pairs anchored to the **trim line** of the page, with the fixed
 * `CROPLINE.SIZE` length.
 *
 * The distance from the media edge is read from the page geometry
 * (`trimBox.x - mediaBox.x`) instead of assumed to be `CROPLINE.DISTANCE`: the mark margin
 * now depends on the crop marks, the bleed size and the mode (`pageMarginMM` in
 * `src/lib/bleed-mode.ts`), so a bleed that grows the page would otherwise leave the marks
 * off the trim line. That is what makes the marks "adapt" instead of hard-coding 6 mm.
 *
 * The mark shapes, lengths and thicknesses are unchanged.
 */
export function addCropMarks(page: PDFPage) {
	const width = page.getWidth();
	const height = page.getHeight();
	const lineSize = CROPLINE.SIZE * MM_TO_POINTS;
	const lineDistance = page.getTrimBox().x - page.getMediaBox().x;

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
