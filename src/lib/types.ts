export type UserSettings = {
	artboard: {
		width: number;
		height: number;
	};
	document: {
		width: number;
		height: number;
	};
	fit: number;
	autoRotate: number;
	cropMarksAndBleed: number;
	bleedSize: number;
	mirrorBleed: number;
	repeat: number;
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
