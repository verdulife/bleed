import type { DocSize, UserSettings } from './types';
import type { PDFPage, PDFImage, PDFEmbeddedPage } from 'pdf-lib';
import { CROPLINE, MM_TO_POINTS } from './constants';

async function getSizeWithCropMarks(page: PDFPage) {
	const { width, height } = page.getSize();
	const widthMM = width * MM_TO_POINTS;
	const heightMM = height * MM_TO_POINTS;
	const cropSizeMM = CROPLINE.SIZE * MM_TO_POINTS;
	const finalWidth = widthMM * cropSizeMM;
	const finalHeight = heightMM * cropSizeMM;

	return { width: finalWidth, height: finalHeight };
}

export async function applyUserSettings(page: PDFPage, settings: UserSettings) {
	const { width, height, bleedSize } = settings;

	const widthMM = width * MM_TO_POINTS;
	const heightMM = height * MM_TO_POINTS;
	const bleedSizeMM = bleedSize * MM_TO_POINTS;
	const withBleedWidth = 2 * bleedSizeMM + widthMM;
	const withBleedHeight = 2 * bleedSizeMM + heightMM;
	const { width: docWidthMM, height: docHeightMM } = await getSizeWithCropMarks(page);
	const cropDistanceMM = CROPLINE.DISTANCE * MM_TO_POINTS;

	page.setSize(docWidthMM, docHeightMM);
	page.setMediaBox(0, 0, docWidthMM, docWidthMM);
	page.setBleedBox(cropDistanceMM, cropDistanceMM, withBleedWidth, withBleedHeight);
	page.setTrimBox(bleedSizeMM, bleedSizeMM, widthMM, heightMM);
}

export async function getEmbedPageScaleAndPosition(embedPage: PDFEmbeddedPage, page: PDFPage) {
	const { width: embedPageWidth, height: embedPageHeight } = embedPage;
	const { width: pageWidth, height: pageHeight } = page.getSize();

	const scale = Math.max(pageWidth / embedPageWidth, pageHeight / embedPageHeight);
	const scaledWidth = embedPageWidth * scale;
	const scaledHeight = embedPageHeight * scale;

	const xOffset = (pageWidth - scaledWidth) / 2;
	const yOffset = (pageHeight - scaledHeight) / 2;

	return {
		x: xOffset,
		y: yOffset,
		xScale: scale,
		yScale: scale
	};
}

export function getImageSize(image: PDFImage, pageSize: DocSize) {
	const imageSize = image.size();
	const pageAspectRatio = pageSize.width / pageSize.height;
	const imageAspectRatio = imageSize.width / imageSize.height;

	if (imageAspectRatio < pageAspectRatio) {
		return {
			width: pageSize.width,
			height: pageSize.width / imageAspectRatio
		};
	} else {
		return {
			width: pageSize.height * imageAspectRatio,
			height: pageSize.height
		};
	}
}

export function getImagePosition(imageSize: DocSize, pageSize: DocSize) {
	const x = (pageSize.width - imageSize.width) / 2;
	const y = (pageSize.height - imageSize.height) / 2;

	return { x, y, width: imageSize.width, height: imageSize.height };
}
