export type UserSettings = {
	width: number;
	height: number;
	bleed: number;
	cropMarks: number;
	repetitions: number;
};

export type UserFile = {
	fileType: string;
	fileBuffer: ArrayBuffer;
};

export type DocSize = {
	width: number;
	height: number;
};
