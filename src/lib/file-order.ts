import type { UserFile } from '@/lib/types';

/**
 * Name comparison used to keep the file list alphabetical by default.
 *
 * Both options are deliberate:
 * - `numeric: true` is a natural sort, so "page2" comes before "page10" instead of
 *   before it only by textual order (which would put "page10" first).
 * - `sensitivity: 'base'` compares base letters only, so the order is case-insensitive
 *   ("Banner.png" and "banner.png" compare equal, no upper/lower-case grouping).
 */
export function compareFileNames(a: UserFile, b: UserFile): number {
	return a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Alphabetical copy of `files`. Non-mutating and id-preserving: the very same file
 * objects come back out, so sorting never reassigns an `id` (the id is the
 * `{#each ... (file.id)}` key and the stable identity used by drag and drop).
 */
export function sortFilesByName(files: UserFile[]): UserFile[] {
	return [...files].sort(compareFileNames);
}

/**
 * Merge rule for files entering the store.
 *
 * Before the user has reordered anything there is no explicit order to respect, so the
 * list is simply kept alphabetical. Once the user has dragged a row, their order wins:
 * the existing list is left untouched and the new files are appended after it.
 *
 * This is the whole business rule, kept pure (no store access) so it can be verified
 * without a browser.
 */
export function addFilesInOrder(
	existing: UserFile[],
	incoming: UserFile[],
	hasManualOrder: boolean
): UserFile[] {
	if (hasManualOrder) return [...existing, ...incoming];
	return sortFilesByName([...existing, ...incoming]);
}
