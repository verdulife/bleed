export type DocSize = {
	width: number;
	height: number;
};

export type BleedSettings = {
	document: DocSize;
	fit: 0 | 1;
	autoRotate: 0 | 1;
	cropMarksAndBleed: 0 | 1;
	bleedSize: number;
	mirrorBleed: 0 | 1;
};

export type RepeatSettings = {
	artboard: DocSize;
	embed: DocSize;
	repeatX: number;
	repeatY: number;
	gapX: number;
	gapY: number;
};

export type UserFile = {
	fileType: string;
	fileBuffer: ArrayBuffer;
	fileName: string;
	id: number;
};

export type PDFOptions = {
	x: number;
	y: number;
	width: number;
	height: number;
};