export type UserSettings = {
	artboard: {
		width: number;
		height: number;
	};
	document: {
		width: number;
		height: number;
	};
	fit: 0 | 1;
	autoRotate: 0 | 1;
	cropMarksAndBleed: 0 | 1;
	bleedSize: number;
	mirrorBleed: 0 | 1;
	/* repeat: 0 | 1;
	repeatX: number;
	repeatY: number;
	gapX: number;
	gapY: number; */
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
