import type { DocSize, UserSettings } from './types';
import type { PDFPage, PDFImage, PDFEmbeddedPage } from 'pdf-lib';
import { CROPLINE, MM_TO_POINTS } from './constants';

async function getSizeWithCropMarks(sizeMM: DocSize) {
	const { width: widthMM, height: heightMM } = sizeMM;
	const cropSizeMM = CROPLINE.DISTANCE * MM_TO_POINTS;
	const width = 2 * cropSizeMM + widthMM;
	const height = 2 * cropSizeMM + heightMM;

	return { width, height };
}

export async function applyUserSettings(page: PDFPage, settings: UserSettings) {
	let { width: mediaWidthMM, height: mediaHeightMM } = page.getSize();
	const { width, height, bleedSize } = settings;

	page.setSize(mediaWidthMM, mediaHeightMM);

	if (settings.cropMarksAndBleed) {
		const widthMM = width * MM_TO_POINTS;
		const heightMM = height * MM_TO_POINTS;
		const bleedSizeMM = bleedSize * MM_TO_POINTS;
		const bleedWidthMM = 2 * bleedSizeMM + widthMM;
		const bleedHeightMM = 2 * bleedSizeMM + heightMM;
		const cropMarkSizeMM = CROPLINE.SIZE * MM_TO_POINTS - CROPLINE.OVERLAY * MM_TO_POINTS;
		const trimDistanceMM = bleedSizeMM + cropMarkSizeMM;
		const mediaSizeMM = await getSizeWithCropMarks({ width: widthMM, height: heightMM });

		mediaWidthMM = mediaSizeMM.width;
		mediaHeightMM = mediaSizeMM.height;

		page.setSize(mediaWidthMM, mediaHeightMM);
		page.setMediaBox(0, 0, mediaWidthMM, mediaHeightMM);
		page.setBleedBox(cropMarkSizeMM, cropMarkSizeMM, bleedWidthMM, bleedHeightMM);
		page.setTrimBox(trimDistanceMM, trimDistanceMM, widthMM, heightMM);
	}
}

/* export async function getEmbedPageScaleAndPosition(embedPage: PDFEmbeddedPage, page: PDFPage) {
	const trimSize = page.getTrimBox();
	const { width: embedPageWidth, height: embedPageHeight } = embedPage;
	const { width: pageWidth, height: pageHeight } = trimSize;

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
} */

export function getPDFScaleAndPosition(embedPage: PDFEmbeddedPage, page: PDFPage) {
	const embedSize = embedPage.size();
	const pageSize = page.getSize();
	const trimSize = page.getTrimBox();
	const embedAspectRatio = embedSize.width / embedSize.height;
	const trimAspectRatio = trimSize.width / trimSize.height;

	let scale, width, height;

	if (embedAspectRatio < trimAspectRatio) {
		scale = trimSize.width / embedSize.width;
		width = trimSize.width;
		height = trimSize.width / embedAspectRatio;
	} else {
		scale = trimSize.height / embedSize.height;
		width = trimSize.height * embedAspectRatio;
		height = trimSize.height;
	}

	const x = (pageSize.width - width) / 2;
	const y = (pageSize.height - height) / 2;

	return { x, y, xScale: scale, yScale: scale };
}

export function getImagePosition(embedImage: PDFImage, page: PDFPage) {
	const embedSize = embedImage.size();
	const pageSize = page.getSize();
	const trimSize = page.getTrimBox();
	const embedAspectRatio = embedSize.width / embedSize.height;
	const trimAspectRatio = trimSize.width / trimSize.height;

	let width, height;

	if (embedAspectRatio < trimAspectRatio) {
		width = trimSize.width;
		height = trimSize.width / embedAspectRatio;
	} else {
		width = trimSize.height * embedAspectRatio;
		height = trimSize.height;
	}

	const x = (pageSize.width - width) / 2;
	const y = (pageSize.height - height) / 2;

	return { x, y, width, height };
}
