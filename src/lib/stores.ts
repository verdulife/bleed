import { type Writable, writable } from 'svelte/store';
import type { UserFile, BleedSettings } from '@/lib/types';

export const bleedSettings: Writable<BleedSettings> = writable({
	document: {
		width: 0,
		height: 0
	},
	fit: 1,
	autoRotate: 1,
	cropMarksAndBleed: 0,
	bleedSize: 2,
	mirrorBleed: 0
});

export const userFiles: Writable<Array<UserFile>> = writable([]);

/**
 * True as soon as the user has reordered the list by hand. While it is false the list is
 * kept alphabetical and new files merge into position; once it is true the explicit order
 * wins and new files append at the end. It resets when the list is emptied.
 */
export const manualOrder: Writable<boolean> = writable(false);

export const previewBlobUri = writable('');

/**
 * User-facing messages about the last generation: one entry per file that could not be
 * processed, plus a closing entry when the document ended up without pages. It is reset at
 * the start of every generation, so the notice never shows a previous run's failures.
 */
export const generationErrors: Writable<string[]> = writable([]);
