import type { UserSettings } from './types';
import type { PDFPage } from 'pdf-lib';

const MM_TO_POINTS = 25.4;

export function getFileURL(file: File) {
	return URL.createObjectURL(file);
}

export function getFileType(file: File) {
	const fileType = file.type.split('/')[1];
	switch (fileType) {
		case 'jpeg':
		case 'png':
			return fileType;
		default:
			return 'pdf';
	}
}

export async function inputFileAsync(): Promise<FileList> {
	const input = document.createElement('input');
	input.type = 'file';
	input.multiple = true;
	input.accept = 'application/pdf, image/jpeg, image/png';
	input.click();

	return new Promise((resolve) => {
		input.addEventListener('change', () => {
			if (input.files) return resolve(input.files);
		});
	});
}

export function applyUserSettings(page: PDFPage, settings: UserSettings) {
	const { width, height } = settings;
	const widthMM = width / MM_TO_POINTS;
	const heightMM = height / MM_TO_POINTS;

	page.setSize(widthMM, heightMM);
}
