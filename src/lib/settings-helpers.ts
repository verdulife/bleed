import type { DocSize, UserSettings } from './types';
import type {
	PDFPage,
	PDFImage,
	PDFEmbeddedPage,
	PDFPageDrawPageOptions,
	PDFPageDrawImageOptions
} from 'pdf-lib';
import { get } from 'svelte/store';
import { CROPLINE, MM_TO_POINTS, POINTS_TO_MM } from '@/lib/constants';
import { userSettings } from '@/lib/stores';
import { needsRotation } from './file-helpers';

/* function getSizeWithCropMarks(sizeMM: DocSize) {
	const { width: widthMM, height: heightMM } = sizeMM;
	const cropSizeMM = CROPLINE.DISTANCE * MM_TO_POINTS;
	const width = 2 * cropSizeMM + widthMM;
	const height = 2 * cropSizeMM + heightMM;

	return { width, height };
}

export async function applyUserSettings(page: PDFPage, settings: UserSettings, embedFile: PDFEmbeddedPage | PDFImage) {
	const { document, bleedSize, cropMarksAndBleed } = settings;
	const embedAspectRatio = embedFile.width / embedFile.height;
	let { width, height } = document;

	if (!width && !height) {
		width = embedFile.width * POINTS_TO_MM;
		height = embedFile.height * POINTS_TO_MM;
	};

	if (!width) width = document.height * embedAspectRatio;
	if (!height) height = document.width / embedAspectRatio;

	const widthMM = width * MM_TO_POINTS;
	const heightMM = height * MM_TO_POINTS;

	let mediaWidthMM = widthMM;
	let mediaHeightMM = heightMM;

	if (cropMarksAndBleed) {
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
} */

export function getEmbedSizeAndPosition(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const settings = get(userSettings);
	let pageSize = page.getSize();
	let trimSize = page.getTrimBox();
	const embedAspectRatio = embedFile.width / embedFile.height;

	if (needsRotation(page, embedFile, settings)) {
		page.setWidth(pageSize.height);
		page.setHeight(pageSize.width);

		pageSize = page.getSize();
		trimSize = page.getTrimBox();
	}

	if (!pageSize.width) pageSize.width = trimSize.height * embedAspectRatio;
	if (!pageSize.height) pageSize.height = trimSize.width / embedAspectRatio;

	page.setSize(pageSize.width, pageSize.height);
	page.setTrimBox(trimSize.x, trimSize.y, trimSize.width, trimSize.height);
	pageSize = page.getSize();
	trimSize = page.getTrimBox();

	const width = settings.fit
		? Math.max(trimSize.width, trimSize.height * embedAspectRatio)
		: Math.min(trimSize.width, trimSize.height * embedAspectRatio);
	const height = settings.fit
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
