import type { PDFOptions, RepeatSettings, GridResult } from '@/lib/types';
import { degrees, PDFDocument, PDFEmbeddedPage, PDFImage, PDFPage, pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath } from 'pdf-lib';
import { get } from 'svelte/store';
import { CROPLINE, FILE_TYPE, isJPEG, isPDF, isPNG, POINTS_TO_MM, toPT } from '@/lib/constants';
import { userFiles, bleedSettings, repeatSettings } from '@/lib/stores';
import { drawMirrorBleed } from '@/lib/settings-helpers';
import { addCropMarks } from '@/lib/crop-marks';
import { closeCropMask, closeMask, openCropMask, openMask } from './pdf-extend';

export function getFileURL(file: File) {
	return URL.createObjectURL(file);
}

export async function getFileType(file: File) {
	function readBufferHeader(file: File, start = 0, end = 8): Promise<ArrayBuffer> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				resolve(reader.result as ArrayBuffer);
			};
			reader.onerror = reject;
			reader.readAsArrayBuffer(file.slice(start, end));
		});
	}

	const buffers = await readBufferHeader(file);
	const uint8Array = new Uint8Array(buffers);

	if (isPDF(uint8Array)) return FILE_TYPE.PDF;
	if (isPNG(uint8Array)) return FILE_TYPE.PNG;
	if (isJPEG(uint8Array)) return FILE_TYPE.JPEG;

	throw new Error('Unsupported file type');
}

export async function inputFileAsync(onlyPdf = false): Promise<FileList> {
	const input = document.createElement('input');
	input.type = 'file';
	input.multiple = true;
	input.accept = onlyPdf ? 'application/pdf' : 'application/pdf, image/jpeg, image/png';
	input.click();

	return new Promise((resolve) => {
		input.addEventListener('change', () => {
			if (input.files) return resolve(input.files);
		});
	});
}

export async function pushFilesToStore(files: FileList) {
	const startIndex = get(userFiles).length;
	const results = await Promise.allSettled(
		Array.from(files).map(async (file, index) => {
			const fileType = await getFileType(file);
			const fileBuffer = await file.arrayBuffer();
			return { fileType, fileBuffer, fileName: file.name, id: startIndex + index };
		})
	);

	const validFiles: Array<{ fileType: string; fileBuffer: ArrayBuffer; fileName: string; id: number }> = [];
	results.forEach((result, index) => {
		if (result.status === 'rejected') {
			alert(`Error loading "${files[index].name}": ${(result.reason as Error).message}`);
		} else {
			validFiles.push(result.value);
		}
	});

	userFiles.update((store) => [...store, ...validFiles]);
}

export function needsRotation(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const mediaBoxSize = page.getMediaBox();
	if (!mediaBoxSize.height || !embedFile.height) return false;

	const mediaBoxRatio = mediaBoxSize.width / mediaBoxSize.height;
	const embedRatio = embedFile.width / embedFile.height;

	return ((embedRatio > 1 && mediaBoxRatio < 1) || (embedRatio < 1 && mediaBoxRatio > 1));
}

function setDocument(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const { document, cropMarksAndBleed, bleedSize: bleedSizeMM, autoRotate } = get(bleedSettings);
	const embedFileRatio = embedFile.width / embedFile.height;
	let { width: userWidthMM, height: userHeightMM } = document;

	if (!userWidthMM && !userHeightMM) {
		userWidthMM = embedFile.width * POINTS_TO_MM;
		userHeightMM = embedFile.height * POINTS_TO_MM;
	};

	if (!userWidthMM) userWidthMM = document.height * embedFileRatio;
	if (!userHeightMM) userHeightMM = document.width / embedFileRatio;

	page.setSize(toPT(userWidthMM), toPT(userHeightMM));
	let rotate = autoRotate && needsRotation(embedFile, page);

	let mediaBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
	let bleedBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
	let trimBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };

	if (rotate) {
		const tempWidth = userWidthMM;
		userWidthMM = userHeightMM;
		userHeightMM = tempWidth;

		mediaBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
		bleedBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
		trimBoxSize = { x: 0, y: 0, width: toPT(userWidthMM), height: toPT(userHeightMM) };
	}

	if (cropMarksAndBleed) {
		const cropMarkSizeMM = CROPLINE.SIZE - CROPLINE.OVERLAY;

		mediaBoxSize = {
			x: 0,
			y: 0,
			width: toPT(CROPLINE.DISTANCE) * 2 + toPT(userWidthMM),
			height: toPT(CROPLINE.DISTANCE) * 2 + toPT(userHeightMM)
		}

		bleedBoxSize = {
			x: toPT(cropMarkSizeMM),
			y: toPT(cropMarkSizeMM),
			width: mediaBoxSize.width - toPT(cropMarkSizeMM) * 2,
			height: mediaBoxSize.height - toPT(cropMarkSizeMM) * 2
		}

		trimBoxSize = {
			x: toPT(bleedSizeMM + cropMarkSizeMM),
			y: toPT(bleedSizeMM + cropMarkSizeMM),
			width: mediaBoxSize.width - toPT(bleedSizeMM) * 2 - toPT(cropMarkSizeMM) * 2,
			height: mediaBoxSize.height - toPT(bleedSizeMM) * 2 - toPT(cropMarkSizeMM) * 2
		}
	}

	page.setMediaBox(
		mediaBoxSize.x,
		mediaBoxSize.y,
		mediaBoxSize.width,
		mediaBoxSize.height
	);
	page.setBleedBox(
		bleedBoxSize.x,
		bleedBoxSize.y,
		bleedBoxSize.width,
		bleedBoxSize.height
	);
	page.setTrimBox(
		trimBoxSize.x,
		trimBoxSize.y,
		trimBoxSize.width,
		trimBoxSize.height
	);
	page.setSize(mediaBoxSize.width, mediaBoxSize.height);

	return rotate;
}

function setEmbed(embedFile: PDFEmbeddedPage | PDFImage, page: PDFPage) {
	const { fit } = get(bleedSettings);
	const mediaBoxSize = page.getMediaBox();
	const trimBoxSize = page.getTrimBox();
	const safeTrimBox = trimBoxSize.width === 0 ? mediaBoxSize : trimBoxSize;
	const embedRatio = embedFile.width / embedFile.height;

	let width = Math.min(safeTrimBox.width, safeTrimBox.height * embedRatio);
	let height = Math.min(safeTrimBox.height, safeTrimBox.width / embedRatio);
	let x = (mediaBoxSize.width - width) / 2;
	let y = (mediaBoxSize.height - height) / 2;

	if (fit) {
		width = Math.max(safeTrimBox.width, safeTrimBox.height * embedRatio);
		height = Math.max(safeTrimBox.height, safeTrimBox.width / embedRatio);
		x = (mediaBoxSize.width - width) / 2;
		y = (mediaBoxSize.height - height) / 2;
	}

	return { x, y, width, height };
}

export function embedFileOnPage(
	embedFile: PDFEmbeddedPage | PDFImage,
	page: PDFPage,
	embedOptions: PDFOptions,
	applyMirrorBleed: boolean
) {
	openCropMask(page);

	if (embedFile.constructor.name.toLowerCase().includes('page')) {
		page.drawPage(embedFile as PDFEmbeddedPage, embedOptions);
	} else {
		page.drawImage(embedFile as PDFImage, embedOptions);
	}

	if (applyMirrorBleed) {
		drawMirrorBleed(page, embedFile, embedOptions);
	}

	closeCropMask(page);
}

function drawPdf(embedFile: PDFEmbeddedPage, page: PDFPage, embedOptions: PDFOptions) {
	const { cropMarksAndBleed, mirrorBleed } = get(bleedSettings);

	embedFileOnPage(embedFile, page, embedOptions, !!mirrorBleed);

	if (cropMarksAndBleed) {
		addCropMarks(page);
	}
}

function drawImage(embedFile: PDFImage, page: PDFPage, embedOptions: PDFOptions) {
	const { cropMarksAndBleed, mirrorBleed } = get(bleedSettings);

	embedFileOnPage(embedFile, page, embedOptions, !!mirrorBleed);

	if (cropMarksAndBleed) {
		addCropMarks(page);
	}
}

export const fileHandler = {
	async [FILE_TYPE.PDF](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const loadedFiles = await PDFDocument.load(file, { ignoreEncryption: true });
		const embedPages = await pdfDoc.embedPages(loadedFiles.getPages());

		for (const embedFile of embedPages) {
			const page = pdfDoc.addPage();

			setDocument(embedFile, page);
			const embedOptions = setEmbed(embedFile, page);
			drawPdf(embedFile, page, embedOptions);
		}
	},

	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const embedFile = await pdfDoc.embedJpg(file);
		const page = pdfDoc.addPage();

		const rotate = setDocument(embedFile, page);
		const embedOptions = setEmbed(embedFile, page);
		drawImage(embedFile, page, embedOptions);

		if (rotate) page.setRotation(degrees(-90));
	},

	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer) {
		const embedFile = await pdfDoc.embedPng(file);
		const page = pdfDoc.addPage();

		setDocument(embedFile, page);
		const embedOptions = setEmbed(embedFile, page);
		drawImage(embedFile, page, embedOptions);
	}
};

export const SAFETY_MARGIN_MM = 6;

export function calculateGrid(
	artboardWidth: number,
	artboardHeight: number,
	elementWidth: number,
	elementHeight: number,
	gapX: number,
	gapY: number,
	totalElements: number
): GridResult {
	const usableWidth = artboardWidth - SAFETY_MARGIN_MM * 2;
	const usableHeight = artboardHeight - SAFETY_MARGIN_MM * 2;

	function countFit(available: number, itemSize: number, gap: number): number {
		if (itemSize <= 0) return 0;
		return Math.floor((available + gap) / (itemSize + gap));
	}

	const normalCols = countFit(usableWidth, elementWidth, gapX);
	const normalRows = countFit(usableHeight, elementHeight, gapY);
	const normalTotal = normalCols * normalRows;

	const rotatedCols = countFit(usableWidth, elementHeight, gapY);
	const rotatedRows = countFit(usableHeight, elementWidth, gapX);
	const rotatedTotal = rotatedCols * rotatedRows;

	const useRotation = rotatedTotal > normalTotal;

	const columns = useRotation ? rotatedCols : normalCols;
	const rows = useRotation ? rotatedRows : normalRows;
	const rotation = useRotation ? 90 : 0;
	const pagesNeeded = Math.max(1, Math.ceil(totalElements / (columns * rows)));

	return {
		columns: Math.max(0, columns),
		rows: Math.max(0, rows),
		rotation,
		pagesNeeded,
		elementWidth: useRotation ? elementHeight : elementWidth,
		elementHeight: useRotation ? elementWidth : elementHeight
	};
}

export async function fileRepeat(pdfDoc: PDFDocument, file: ArrayBuffer, fileType: string, page: PDFPage) {
	// TODO: Replace with new grid-based layout (Step 4)
	// Temporary: draw file once at center of page
	const settings = get(repeatSettings);
	const embedWidth = toPT(settings.embed.width || 50);
	const embedHeight = toPT(settings.embed.height || 50);
	const pageSize = page.getSize();

	if (fileType === FILE_TYPE.PDF) {
		const loadedFiles = await PDFDocument.load(file, { ignoreEncryption: true });
		const embedPages = await pdfDoc.embedPages(loadedFiles.getPages());
		for (const embedFile of embedPages) {
			page.drawPage(embedFile, {
				x: (pageSize.width - embedWidth) / 2,
				y: (pageSize.height - embedHeight) / 2,
				width: embedWidth,
				height: embedHeight
			});
		}
	} else {
		const embedFile = fileType === FILE_TYPE.JPEG
			? await pdfDoc.embedJpg(file)
			: await pdfDoc.embedPng(file);
		page.drawImage(embedFile, {
			x: (pageSize.width - embedWidth) / 2,
			y: (pageSize.height - embedHeight) / 2,
			width: embedWidth,
			height: embedHeight
		});
	}
}

export type ElementPosition = {
	col: number;
	row: number;
	totalCols: number;
	totalRows: number;
};

export function drawElement(
	page: PDFPage,
	embedFile: PDFEmbeddedPage | PDFImage,
	position: ElementPosition,
	elementWidthMM: number,
	elementHeightMM: number,
	gapXMM: number,
	gapYMM: number,
	bleedSizeMM: number,
	rotation: 0 | 90,
	artboardWidthMM: number,
	artboardHeightMM: number
) {
	const { col, row, totalCols, totalRows } = position;
	const safetyPt = toPT(SAFETY_MARGIN_MM);
	const elementW = toPT(elementWidthMM);
	const elementH = toPT(elementHeightMM);
	const gapX = toPT(gapXMM);
	const gapY = toPT(gapYMM);
	const bleedSize = toPT(bleedSizeMM);

	// Guard against invalid dimensions
	if (!elementW || !elementH || !totalCols || !totalRows) {
		return { cellX: 0, cellY: 0, cellW: elementW, cellH: elementH };
	}

	// Grid centering in artboard
	const artboardW = Number(artboardWidthMM) || 210;
	const artboardH = Number(artboardHeightMM) || 297;
	const usableWidth = toPT(artboardW - SAFETY_MARGIN_MM * 2);
	const usableHeight = toPT(artboardH - SAFETY_MARGIN_MM * 2);
	const gridWidth = totalCols * elementW + (totalCols - 1) * gapX;
	const gridHeight = totalRows * elementH + (totalRows - 1) * gapY;
	const offsetX = Math.max(0, (usableWidth - gridWidth) / 2);
	const offsetY = Math.max(0, (usableHeight - gridHeight) / 2);

	const gridStartX = safetyPt + offsetX;
	const gridStartY = safetyPt + offsetY;

	const cellX = gridStartX + col * (elementW + gapX);
	const cellY = gridStartY + row * (elementH + gapY);

	// Adaptive clip per side
	// Side with neighbor: clip = gap/2 from element edge
	// Side free (border): clip = up to safety margin
	const gapLeft = col > 0 ? gapX / 2 : cellX - safetyPt;
	const gapRight = col < totalCols - 1 ? gapX / 2 : (safetyPt + usableWidth) - (cellX + elementW);
	const gapBottom = row > 0 ? gapY / 2 : cellY - safetyPt;
	const gapTop = row < totalRows - 1 ? gapY / 2 : (safetyPt + usableHeight) - (cellY + elementH);

	// Clip between 0 (no bleed visible) and bleedSize (full bleed visible)
	const clipLeft = Math.max(0, Math.min(gapLeft, bleedSize));
	const clipRight = Math.max(0, Math.min(gapRight, bleedSize));
	const clipBottom = Math.max(0, Math.min(gapBottom, bleedSize));
	const clipTop = Math.max(0, Math.min(gapTop, bleedSize));

	const clipX = cellX - clipLeft;
	const clipY = cellY - clipBottom;
	const clipW = elementW + clipLeft + clipRight;
	const clipH = elementH + clipTop + clipBottom;

	const isPdf = embedFile.constructor.name.toLowerCase().includes('page');

	// Push graphics state + apply clip
	page.pushOperators(pushGraphicsState());
	page.pushOperators(
		moveTo(clipX, clipY),
		lineTo(clipX + clipW, clipY),
		lineTo(clipX + clipW, clipY + clipH),
		lineTo(clipX, clipY + clipH),
		closePath(),
		clip(),
		endPath()
	);

	// Fit content to cell: scale to fill, crop overflow (no deformation)
	const embedRatio = embedFile.width / embedFile.height;

	// Guard against invalid embed dimensions
	if (!embedFile.width || !embedFile.height || isNaN(embedRatio)) {
		page.pushOperators(popGraphicsState());
		return { cellX, cellY, cellW: elementW, cellH: elementH };
	}

	// When rotation=90, the effective cell dimensions swap
	const fitW = rotation === 90 ? elementH : elementW;
	const fitH = rotation === 90 ? elementW : elementH;

	// Scale to fill the cell (larger dimension gets cropped)
	const scaleToWidth = fitW / embedFile.width;
	const scaleToHeight = fitH / embedFile.height;
	const scale = Math.max(scaleToWidth, scaleToHeight);

	const drawW = embedFile.width * scale;
	const drawH = embedFile.height * scale;

	// Center in cell
	// When rotation=90, pdf-lib's transform maps:
	//   (0,0)→(drawX,drawY), (0,drawH)→(drawX-drawH,drawY)
	// So visual x-range is [drawX-drawH, drawX], visual width = drawH
	// For visual center at cell center: drawX = cellX + (elementW + drawH)/2
	const drawX = rotation === 90
		? cellX + (elementW + drawH) / 2
		: cellX + (elementW - drawW) / 2;
	const drawY = rotation === 90
		? cellY + (elementH - drawW) / 2
		: cellY + (elementH - drawH) / 2;

	const embedOptions: PDFOptions & { rotate?: any } = { x: drawX, y: drawY, width: drawW, height: drawH };

	if (rotation === 90) {
		embedOptions.rotate = degrees(90);
	}

	if (isPdf) {
		page.drawPage(embedFile as PDFEmbeddedPage, embedOptions);
	} else {
		page.drawImage(embedFile as PDFImage, embedOptions);
	}

	// Mirror bleed
	const { mirrorBleed } = get(bleedSettings);
	if (mirrorBleed) {
		drawMirrorBleed(page, embedFile, {
			x: cellX,
			y: cellY,
			width: elementW,
			height: elementH
		});
	}

	page.pushOperators(popGraphicsState());

	return { cellX, cellY, cellW: elementW, cellH: elementH };
}
