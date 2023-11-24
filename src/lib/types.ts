export type UserSettings = {
	width: number;
	height: number;
	cropMarksAndBleed: number;
	bleedSize: number;
	mirrorBleed: number;
	repetitions: number;
};

export type UserFile = {
	fileType: string;
	fileBuffer: ArrayBuffer;
	fileName: string;
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
