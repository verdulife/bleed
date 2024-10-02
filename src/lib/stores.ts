import { type Writable, writable } from 'svelte/store';
import type { UserFile, UserSettings } from './types';

export const userSettings: Writable<UserSettings> = writable({
	artboard: {
		width: 320,
		height: 450
	},
	document: {
		width: 85,
		height: 54
	},
	fit: 1,
	autoRotate: 1,
	cropMarksAndBleed: 0,
	bleedSize: 3,
	mirrorBleed: 0,
	/* repeat: 0,
	repeatX: 1,
	repeatY: 1,
	gapX: 3,
	gapY: 3 */
});

export const userFiles: Writable<Array<UserFile>> = writable([]);

export const previewBlobUri = writable('');
