import type { Degrees } from "pdf-lib";

export type UserSettings = {
	document: {
		width: number;
		height: number;
	};
	fit: 0 | 1;
	autoRotate: 0 | 1;
	cropMarksAndBleed: 0 | 1;
	bleedSize: number;
	mirrorBleed: 0 | 1;
};

export type UserFile = {
	fileType: string;
	fileBuffer: ArrayBuffer;
	fileName: string;
	id: number;
};

export type DocSize = {
	width: number;
	height: number;
};

export type PDFCropBox = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type PDFEmbedOptions = {
	x: number;
	y: number;
	width: number;
	height: number;
};
