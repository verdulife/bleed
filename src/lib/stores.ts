import { type Writable, writable } from 'svelte/store';
import type { UserFile, UserSettings } from '@/lib/types';

export const userSettings: Writable<UserSettings> = writable({
	document: {
		width: 0,
		height: 0
	},
	fit: 1,
	autoRotate: 1,
	cropMarksAndBleed: 0,
	bleedSize: 3,
	mirrorBleed: 0
});

export const userFiles: Writable<Array<UserFile>> = writable([]);

export const previewBlobUri = writable('');
