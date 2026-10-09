/**
 * Verification cases for the alphabetical ordering rule and the manual-order policy
 * (`src/lib/file-order.ts`, T3 part A).
 *
 * Unlike `file-ids.ts`, the module under test is pure: it has no browser API and no
 * store access, so the fixtures are plain `UserFile`-shaped objects and no
 * `FileReader`/`alert` double is needed here.
 *
 * The import stays dynamic (same pattern as `file-ids.ts`) so that a missing or
 * broken module is reported as a failing case instead of crashing the whole runner.
 */
import type { UserFile } from '@/lib/types';
import type { VerifyCase } from './harness';
import { assert, assertArrayEqual, assertEqual, assertUnique } from './harness';

// --- module under test -------------------------------------------------------

type FileOrderModule = typeof import('@/lib/file-order');

let loaded: Promise<FileOrderModule> | null = null;

function loadModuleUnderTest(): Promise<FileOrderModule> {
	loaded ??= import('@/lib/file-order');
	return loaded;
}

// --- fixtures ----------------------------------------------------------------

/**
 * Minimal `UserFile`: only `fileName` and `id` matter for ordering, but the object is
 * kept fully shaped so the fixtures match the real store payload.
 */
function makeUserFile(fileName: string, id: number): UserFile {
	return { fileType: 'image/png', fileBuffer: new ArrayBuffer(0), fileName, id };
}

function namesOf(files: UserFile[]): string[] {
	return files.map((file) => file.fileName);
}

function idsOf(files: UserFile[]): number[] {
	return files.map((file) => file.id);
}

// --- cases -------------------------------------------------------------------

export function getFileOrderCases(): VerifyCase[] {
	return [
		{
			name: 'file-order: sortFilesByName orders case-insensitively and naturally',
			run: async () => {
				const { sortFilesByName } = await loadModuleUnderTest();

				const sorted = sortFilesByName([
					makeUserFile('Page10.png', 1),
					makeUserFile('page2.png', 2),
					makeUserFile('page1.png', 3),
					makeUserFile('Banner.png', 4)
				]);

				assertArrayEqual(
					namesOf(sorted),
					['Banner.png', 'page1.png', 'page2.png', 'Page10.png'],
					'sort must be case-insensitive and put page2 before page10'
				);

				const names = namesOf(sorted);
				assert(
					names.indexOf('page2.png') < names.indexOf('Page10.png'),
					'natural sort must place "page2" before "page10"'
				);
			}
		},
		{
			name: 'file-order: sorting does not mutate the input and does not change any id',
			run: async () => {
				const { sortFilesByName } = await loadModuleUnderTest();

				const input = [
					makeUserFile('zebra.png', 10),
					makeUserFile('apple.png', 11),
					makeUserFile('mango.png', 12)
				];
				const inputNamesBefore = namesOf(input);

				const sorted = sortFilesByName(input);

				assert(sorted !== input, 'sortFilesByName must return a new array, not the input');
				assertArrayEqual(
					namesOf(input),
					inputNamesBefore,
					'the input array must keep its original order'
				);

				// Identity, not just equality: the very same objects (and therefore ids) must
				// come back out, so reordering never reassigns ids.
				assertArrayEqual(
					namesOf(sorted),
					['apple.png', 'mango.png', 'zebra.png'],
					'sort must order the same objects by name'
				);
				for (const file of sorted) {
					assert(input.includes(file), `sorted must reuse the input object for ${file.fileName}`);
				}
				assertArrayEqual(idsOf(sorted), [11, 12, 10], 'ids must travel with their file object');
				assertUnique(idsOf(sorted), 'sorted ids');
			}
		},
		{
			name: 'file-order: without manual order, adding files merges alphabetically',
			run: async () => {
				const { addFilesInOrder } = await loadModuleUnderTest();

				const existing = [makeUserFile('cherry.png', 1), makeUserFile('apple.png', 2)];
				const incoming = [makeUserFile('banana.png', 3)];

				const merged = addFilesInOrder(existing, incoming, false);

				assertArrayEqual(
					namesOf(merged),
					['apple.png', 'banana.png', 'cherry.png'],
					'a non-manual list must stay alphabetical after an add'
				);
				assertArrayEqual(idsOf(merged), [2, 3, 1], 'ids must follow their file objects');
			}
		},
		{
			name: 'file-order: with manual order, new files are appended in incoming order',
			run: async () => {
				const { addFilesInOrder } = await loadModuleUnderTest();

				const existing = [makeUserFile('cherry.png', 1), makeUserFile('apple.png', 2)];
				const incoming = [makeUserFile('durian.png', 3), makeUserFile('banana.png', 4)];

				const merged = addFilesInOrder(existing, incoming, true);

				assertArrayEqual(
					namesOf(merged),
					['cherry.png', 'apple.png', 'durian.png', 'banana.png'],
					'a manual order must be preserved and new files appended at the end'
				);
			}
		},
		{
			name: 'file-order: a new file sorting first still lands at the end of a manual order',
			run: async () => {
				const { addFilesInOrder } = await loadModuleUnderTest();

				const existing = [makeUserFile('zebra.png', 1), makeUserFile('mango.png', 2)];
				const incoming = [makeUserFile('aaa.png', 3)];

				const merged = addFilesInOrder(existing, incoming, true);

				assertArrayEqual(
					namesOf(merged),
					['zebra.png', 'mango.png', 'aaa.png'],
					'"aaa.png" must not be sorted into a manually ordered list'
				);
				assertEqual(merged[merged.length - 1].id, 3, 'the appended file keeps its own id');
			}
		}
	];
}
