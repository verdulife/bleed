import type { DocSize, UserSettings } from './types';
import type {
	PDFPage,
	PDFImage,
	PDFEmbeddedPage,
	PDFPageDrawPageOptions,
	PDFPageDrawImageOptions
} from 'pdf-lib';
import { CROPLINE, MM_TO_POINTS } from './constants';
import { get } from 'svelte/store';
import { userSettings } from './stores';

async function getSizeWithCropMarks(sizeMM: DocSize) {
	const { width: widthMM, height: heightMM } = sizeMM;
	const cropSizeMM = CROPLINE.DISTANCE * MM_TO_POINTS;
	const width = 2 * cropSizeMM + widthMM;
	const height = 2 * cropSizeMM + heightMM;

	return { width, height };
}

export async function applyUserSettings(page: PDFPage, settings: UserSettings) {
	const { document, bleedSize } = settings;
	const { width, height } = document;
	const widthMM = width * MM_TO_POINTS;
	const heightMM = height * MM_TO_POINTS;

	let mediaWidthMM = widthMM;
	let mediaHeightMM = heightMM;

	if (settings.cropMarksAndBleed) {
		const bleedSizeMM = bleedSize * MM_TO_POINTS;
		const bleedWidthMM = 2 * bleedSizeMM + widthMM;
		const bleedHeightMM = 2 * bleedSizeMM + heightMM;
		const cropMarkSizeMM = CROPLINE.SIZE * MM_TO_POINTS - CROPLINE.OVERLAY * MM_TO_POINTS;
		const trimSizeMM = bleedSizeMM + cropMarkSizeMM;
		const mediaSizeMM = await getSizeWithCropMarks({ width: widthMM, height: heightMM });

		mediaWidthMM = mediaSizeMM.width;
		mediaHeightMM = mediaSizeMM.height;

		page.setMediaBox(0, 0, mediaWidthMM, mediaHeightMM);
		page.setBleedBox(cropMarkSizeMM, cropMarkSizeMM, bleedWidthMM, bleedHeightMM);
		page.setTrimBox(trimSizeMM, trimSizeMM, widthMM, heightMM);
	}

	page.setSize(mediaWidthMM, mediaHeightMM);
}

export function getEmbedSizeAndPosition(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const { fit } = get(userSettings);
	const pageSize = page.getSize();
	const trimSize = page.getTrimBox();
	const embedAspectRatio = embedFile.width / embedFile.height;

	const width = fit
		? Math.max(trimSize.width, trimSize.height * embedAspectRatio)
		: Math.min(trimSize.width, trimSize.height * embedAspectRatio);
	const height = fit
		? Math.max(trimSize.height, trimSize.width / embedAspectRatio)
		: Math.min(trimSize.height, trimSize.width / embedAspectRatio);

	const x = (pageSize.width - width) / 2;
	const y = (pageSize.height - height) / 2;

	return { x, y, width, height };
}

export function applyMirroBleed(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const embedType = embedFile.constructor.name.toLowerCase();
	const isPdf = embedType.includes('page');
	const mediaSize = page.getMediaBox();

	const draw = (options: PDFPageDrawPageOptions | PDFPageDrawImageOptions) => {
		if (isPdf) page.drawPage(embedFile as PDFEmbeddedPage, options);
		else page.drawImage(embedFile as PDFImage, options);
	};

	const { width, height } = getEmbedSizeAndPosition(embedFile, page);

	//top-left
	draw({
		x: mediaSize.width / 2 - width / 2,
		y: mediaSize.height / 2 - height / 2 + height * 2,
		width: -width,
		height: -height
	});

	//center-left
	draw({
		x: mediaSize.width / 2 - width / 2,
		y: mediaSize.height / 2 - height / 2,
		width: -width,
		height
	});

	//bottom-left
	draw({
		x: mediaSize.width / 2 - width / 2,
		y: mediaSize.height / 2 - height / 2,
		width: -width,
		height: -height
	});

	//top-center
	draw({
		x: mediaSize.width / 2 - width / 2,
		y: mediaSize.height / 2 - height / 2 + height * 2,
		width,
		height: -height
	});

	//bottom-center
	draw({
		x: mediaSize.width / 2 - width / 2,
		y: mediaSize.height / 2 - height / 2,
		width,
		height: -height
	});

	//top-right
	draw({
		x: mediaSize.width / 2 - width / 2 + width * 2,
		y: mediaSize.height / 2 - height / 2 + height * 2,
		width: -width,
		height: -height
	});

	//center-right
	draw({
		x: mediaSize.width / 2 - width / 2 + width * 2,
		y: mediaSize.height / 2 - height / 2,
		width: -width,
		height
	});

	//bottom-right
	draw({
		x: mediaSize.width / 2 - width / 2 + width * 2,
		y: mediaSize.height / 2 - height / 2,
		width: -width,
		height: -height
	});
}
