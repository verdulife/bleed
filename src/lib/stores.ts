import { type Writable, writable } from 'svelte/store';
import type { UserFile, BleedSettings, RepeatSettings } from '@/lib/types';

export const bleedSettings: Writable<BleedSettings> = writable({
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

export const repeatSettings: Writable<RepeatSettings> = writable({
	artboard: {
		width: 0,
		height: 0
	},
	embed: {
		width: 0,
		height: 0
	},
	repeatX: 1,
	repeatY: 1,
	gapX: 0,
	gapY: 0
});

export const userFiles: Writable<Array<UserFile>> = writable([]);

export const previewBlobUri = writable('');
