export type UserSettings = {
	width: number;
	height: number;
	bleed: number;
	cutMarks: false;
	repetitions: number;
};

export type UserFile = {
	fileType: string;
	fileBuffer: ArrayBuffer;
};
