import { writable, type Writable } from 'svelte/store';
import type { UserFile, UserSettings } from './types';

export const userSettings: Writable<UserSettings> = writable({
	width: 210,
	height: 297,
	cropMarksAndBleed: 1,
	bleedSize: 3,
	mirrorBleed: 0,
	repetitions: 1
});

export const userFiles: Writable<Array<UserFile>> = writable([]);

export const previewBlobUri = writable('');
