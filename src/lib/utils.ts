import type { DocSize, UserSettings } from './types';
import type { PDFPage, PDFImage } from 'pdf-lib';

const MM_TO_POINTS = 2.83465;

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
	const widthMM = width * MM_TO_POINTS;
	const heightMM = height * MM_TO_POINTS;

	page.setSize(widthMM, heightMM);
}

export function getImageSize(image: PDFImage, pageSize: DocSize) {
	const imageSize = image.size();
	const pageAspectRatio = pageSize.width / pageSize.height;
	const imageAspectRatio = imageSize.width / imageSize.height;

	if (imageAspectRatio < pageAspectRatio) {
		return {
			width: pageSize.width,
			height: pageSize.width / imageAspectRatio
		};
	} else {
		return {
			width: pageSize.height * imageAspectRatio,
			height: pageSize.height
		};
	}
}

export function getImagePosition(imageSize: DocSize, pageSize: DocSize) {
	const x = (pageSize.width - imageSize.width) / 2;
	const y = (pageSize.height - imageSize.height) / 2;

	return { x, y, width: imageSize.width, height: imageSize.height };
}
