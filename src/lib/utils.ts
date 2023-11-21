export function getFileURL(file: File) {
	return URL.createObjectURL(file);
}

export async function inputFileAsync(): Promise<FileList> {
	const input = document.createElement('input');
	input.type = 'file';
	input.multiple = true;
	input.accept = 'application/pdf, image/jpeg, imgage/png';
	input.click();

	return new Promise((resolve) => {
		input.addEventListener('change', () => {
			if (input.files) return resolve(input.files);
		});
	});
}
