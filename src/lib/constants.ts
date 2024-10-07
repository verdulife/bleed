export const MM_TO_POINTS = 2.83465;
export const POINTS_TO_MM = 1 / MM_TO_POINTS;

export function toMM(PT: number) {
	return PT * POINTS_TO_MM;
}

export function toPT(MM: number) {
	return MM * MM_TO_POINTS;
}

export const FILE_TYPE = {
	PDF: 'pdf',
	JPEG: 'jpeg',
	PNG: 'png'
};

export const CROPLINE = {
	SIZE: 4,
	DISTANCE: 6,
	OVERLAY: 1
};

export const SIZE_PRESETS = {
	A0: {
		width: 841,
		height: 1189
	},
	A1: {
		width: 594,
		height: 841
	},
	A2: {
		width: 420,
		height: 594
	},
	SRA3: {
		width: 320,
		height: 450
	},
	A3: {
		width: 297,
		height: 420
	},
	A4: {
		width: 210,
		height: 297
	},
	A5: {
		width: 148,
		height: 210
	},
	A6: {
		width: 105,
		height: 148
	},
	DL: {
		width: 100,
		height: 200
	},
	Cards: {
		width: 54,
		height: 85
	}
};

function checkFileHeader(headers: number[]) {
	return (buffers: Uint8Array, options = { offset: 0 }) =>
		headers.every(
			(header, index) => header === buffers[options.offset + index]
		);
}

export const isPNG = checkFileHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const isJPEG = checkFileHeader([0xff, 0xd8, 0xff]);