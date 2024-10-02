import type { UserSettings } from '@/lib/types';
import { PDFDocument } from 'pdf-lib';
import { FILE_TYPE } from '@/lib/constants';
import { addCropMarks } from '@/lib/crop-marks';
import { closeCropMask, cropMask } from '@/lib/pdf-extend';
import { applyUserSettings, getEmbedSizeAndPosition, applyMirroBleed } from '@/lib/settings-helpers';
import { userFiles } from '@/lib/stores';

export function getFileURL(file: File) {
	return URL.createObjectURL(file);
}

export function getFileType(file: File) {
	const fileType = file.type.split('/')[1];
	if (fileType === 'pdf') return 'pdf';
	else return fileType;
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

export async function pushFilesToStore(files: FileList) {
	Array.from(files).forEach(async (file: File) => {
		const fileType = getFileType(file);
		const fileBuffer = await file.arrayBuffer();
		const fileName = file.name;

		userFiles.update((store) => {
			const id = store.length;
			return (store = [...store, { fileType, fileBuffer, fileName, id }]);
		});
	});
}

export const fileHandlers = {
	async [FILE_TYPE.PDF](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const existingPdfDoc = await PDFDocument.load(file);
		const embedPages = await pdfDoc.embedPages(existingPdfDoc.getPages());

		embedPages.forEach(async (embedPage) => {
			const page = pdfDoc.addPage();
			await applyUserSettings(page, settings);
			const embedSizeAndPosition = getEmbedSizeAndPosition(embedPage, page);

			if (settings.cropMarksAndBleed) {
				const bleedBox = page.getBleedBox();
				cropMask(page, bleedBox);
			}

			page.drawPage(embedPage, embedSizeAndPosition);
			if (settings.mirrorBleed) applyMirroBleed(embedPage, page);

			if (settings.cropMarksAndBleed) {
				closeCropMask(page);
				addCropMarks(page);
			}
		});
	},

	async [FILE_TYPE.JPEG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedJpg(file);
		const page = pdfDoc.addPage();
		await applyUserSettings(page, settings);
		const embedSizeAndPosition = getEmbedSizeAndPosition(image, page);

		if (settings.cropMarksAndBleed) {
			const bleedBox = page.getBleedBox();
			cropMask(page, bleedBox);
		}

		page.drawImage(image, embedSizeAndPosition);
		if (settings.mirrorBleed) applyMirroBleed(image, page);

		if (settings.cropMarksAndBleed) {
			closeCropMask(page);
			addCropMarks(page);
		}
	},

	async [FILE_TYPE.PNG](pdfDoc: PDFDocument, file: ArrayBuffer, settings: UserSettings) {
		const image = await pdfDoc.embedPng(file);
		const page = pdfDoc.addPage();
		await applyUserSettings(page, settings);
		const embedSizeAndPosition = getEmbedSizeAndPosition(image, page);

		if (settings.cropMarksAndBleed) {
			const bleedBox = page.getBleedBox();
			cropMask(page, bleedBox);
		}

		page.drawImage(image, embedSizeAndPosition);
		if (settings.mirrorBleed) applyMirroBleed(image, page);

		if (settings.cropMarksAndBleed) {
			closeCropMask(page);
			addCropMarks(page);
		}
	}
};
