/**
 * Verification cases for stable file ids (`pushFilesToStore`, T2 part A).
 *
 * The module under test is browser code: it reads file headers through `FileReader`
 * and reports rejected files through `alert`. Bun implements neither, so both are
 * replaced by minimal test doubles *before* `@/lib/file-helpers` is imported
 * (dynamic import below). Everything else the module touches (`Blob`/`File.slice`,
 * `arrayBuffer`, `svelte/store`) is provided by Bun.
 */
import { get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { UserFile } from '@/lib/types';
import type { VerifyCase } from './harness';
import { assert, assertArrayEqual, assertEqual, assertUnique } from './harness';

// --- browser API test doubles -------------------------------------------------

const alertMessages: string[] = [];

/** Records the messages instead of opening a browser dialog. */
(globalThis as unknown as { alert: (message?: unknown) => void }).alert = (message?: unknown) => {
	alertMessages.push(String(message));
};

/**
 * Minimal `FileReader` test double: the module only ever calls
 * `new FileReader()`, assigns `onload`/`onerror` and calls
 * `readAsArrayBuffer(file.slice(start, end))`, so delegating to
 * `Blob.arrayBuffer()` is enough.
 */
class FileReaderDouble {
	result: ArrayBuffer | null = null;
	onload: (() => void) | null = null;
	onerror: ((error: unknown) => void) | null = null;

	readAsArrayBuffer(blob: Blob) {
		blob.arrayBuffer().then(
			(buffer) => {
				this.result = buffer;
				this.onload?.();
			},
			(error: unknown) => {
				this.onerror?.(error);
			}
		);
	}
}

(globalThis as unknown as { FileReader: unknown }).FileReader = FileReaderDouble;

// --- module under test (loaded after the doubles are installed) ---------------

type FileHelpersModule = typeof import('@/lib/file-helpers');

let loaded: Promise<FileHelpersModule> | null = null;

function loadModuleUnderTest(): Promise<FileHelpersModule> {
	loaded ??= import('@/lib/file-helpers');
	return loaded;
}

/** `userFiles` lives in `@/lib/stores`; only the shared instance matters here. */
async function loadStores(): Promise<typeof import('@/lib/stores')> {
	return import('@/lib/stores');
}

// --- fixture helpers ---------------------------------------------------------

/** Magic headers that `getFileType` (via `@/lib/constants`) classifies. */
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff];
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const UNSUPPORTED_HEADER = [0x00, 0x01, 0x02, 0x03]; // no known signature

function makeFile(name: string, header: number[]): File {
	return new File([new Uint8Array(header)], name);
}

/**
 * `pushFilesToStore` is typed as taking a `FileList`, but at runtime it only needs an
 * array-like of `File` (`Array.from(files)` + `files[index].name`), so an array cast
 * is enough for the harness.
 */
function makeFileList(files: File[]): FileList {
	return files as unknown as FileList;
}

function idsOf(files: UserFile[]): number[] {
	return files.map((file) => file.id);
}

function namesOf(files: UserFile[]): string[] {
	return files.map((file) => file.fileName);
}

/** Mirrors what the UI does when the user removes one file by id. */
function removeById(userFiles: Writable<UserFile[]>, id: number) {
	userFiles.update((files) => files.filter((file) => file.id !== id));
}

// --- cases -------------------------------------------------------------------

export function getFileIdsCases(): VerifyCase[] {
	return [
		{
			name: 'file-ids: adding three files assigns unique ids in incoming order',
			run: async () => {
				const { pushFilesToStore } = await loadModuleUnderTest();
				const { userFiles } = await loadStores();
				userFiles.set([]);

				await pushFilesToStore(
					makeFileList([
						makeFile('a.png', PNG_HEADER),
						makeFile('b.jpg', JPEG_HEADER),
						makeFile('c.pdf', PDF_HEADER)
					])
				);

				const stored = get(userFiles);
				assertEqual(stored.length, 3, 'three supported files must be stored');
				assertArrayEqual(namesOf(stored), ['a.png', 'b.jpg', 'c.pdf'], 'store keeps incoming order');

				const ids = idsOf(stored);
				assertUnique(ids, 'first batch');
				assert(ids[0] < ids[1] && ids[1] < ids[2], 'ids must increase with the incoming order');
			}
		},
		{
			name: 'file-ids: remove the middle file, then add another -> all ids stay unique',
			run: async () => {
				const { pushFilesToStore } = await loadModuleUnderTest();
				const { userFiles } = await loadStores();
				userFiles.set([]);

				await pushFilesToStore(
					makeFileList([
						makeFile('a.png', PNG_HEADER),
						makeFile('b.jpg', JPEG_HEADER),
						makeFile('c.pdf', PDF_HEADER)
					])
				);

				const middleId = get(userFiles)[1].id;
				removeById(userFiles, middleId);
				assertEqual(get(userFiles).length, 2, 'removing one file must shrink the store');

				await pushFilesToStore(makeFileList([makeFile('d.png', PNG_HEADER)]));

				const stored = get(userFiles);
				assertEqual(stored.length, 3, 'the store must hold the two survivors plus the new file');
				assertUnique(idsOf(stored), 'after removing the middle file and adding another');
			}
		},
		{
			name: 'file-ids: a file with an unsupported header is rejected with an alert',
			run: async () => {
				const { pushFilesToStore } = await loadModuleUnderTest();
				const { userFiles } = await loadStores();
				userFiles.set([]);
				alertMessages.length = 0;

				await pushFilesToStore(
					makeFileList([
						makeFile('good.png', PNG_HEADER),
						makeFile('bad.txt', UNSUPPORTED_HEADER)
					])
				);

				const stored = get(userFiles);
				assertArrayEqual(namesOf(stored), ['good.png'], 'only supported files may enter the store');
				assertEqual(alertMessages.length, 1, 'exactly one alert must be raised');
				assert(
					alertMessages[0].includes('bad.txt'),
					`the alert must name the rejected file, got "${alertMessages[0]}"`
				);
			}
		},
		{
			name: 'file-ids: a later add keeps the files already in the store',
			run: async () => {
				const { pushFilesToStore } = await loadModuleUnderTest();
				const { userFiles } = await loadStores();
				userFiles.set([]);

				await pushFilesToStore(makeFileList([makeFile('a.png', PNG_HEADER)]));
				await pushFilesToStore(makeFileList([makeFile('b.jpg', JPEG_HEADER)]));

				const stored = get(userFiles);
				assertArrayEqual(
					namesOf(stored),
					['a.png', 'b.jpg'],
					'an update must append without dropping the previous files'
				);
			}
		}
	];
}
