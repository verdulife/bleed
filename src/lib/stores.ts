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
