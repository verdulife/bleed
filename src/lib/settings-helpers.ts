import type { DocSize, UserSettings } from './types';
import type { PDFPage, PDFImage, PDFEmbeddedPage } from 'pdf-lib';
import { CROPLINE, MM_TO_POINTS } from './constants';
import { addCropMarks } from './crop-marks';

async function getSizeWithCropMarks(sizeMM: DocSize) {
	const { width: widthMM, height: heightMM } = sizeMM;
	const cropSizeMM = CROPLINE.SIZE * MM_TO_POINTS;
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
		const cropMarkDistanceMM = CROPLINE.DISTANCE * MM_TO_POINTS;
		const trimDistanceMM = bleedSizeMM + cropMarkDistanceMM;
		const mediaSizeMM = await getSizeWithCropMarks({ width: widthMM, height: heightMM });

		//TODO: buscar la diferencia entre el bleed y la marca de corte

		mediaWidthMM = mediaSizeMM.width;
		mediaHeightMM = mediaSizeMM.height;

		page.setSize(mediaWidthMM, mediaHeightMM);
		page.setMediaBox(0, 0, mediaWidthMM, mediaHeightMM);
		page.setBleedBox(cropMarkDistanceMM, cropMarkDistanceMM, bleedWidthMM, bleedHeightMM);
		page.setTrimBox(trimDistanceMM, trimDistanceMM, widthMM, heightMM);

		addCropMarks(page);
	}
}

export async function getEmbedPageScaleAndPosition(embedPage: PDFEmbeddedPage, trimSize: DocSize) {
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
}

export function getImageSize(image: PDFImage, page: PDFPage) {
	const imageSize = image.size();
	const trimSize = page.getTrimBox();
	const trimAspectRatio = trimSize.width / trimSize.height;
	const imageAspectRatio = imageSize.width / imageSize.height;

	if (imageAspectRatio < trimAspectRatio) {
		return {
			width: trimSize.width,
			height: trimSize.width / imageAspectRatio
		};
	} else {
		return {
			width: trimSize.height * imageAspectRatio,
			height: trimSize.height
		};
	}
}

export function getImagePosition(imageSize: DocSize, page: PDFPage) {
	const pageSize = page.getSize();
	const x = (pageSize.width - imageSize.width) / 2;
	const y = (pageSize.height - imageSize.height) / 2;

	return { x, y, width: imageSize.width, height: imageSize.height };
}
