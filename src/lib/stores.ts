import { writable, type Writable } from 'svelte/store';
import type { UserFile, UserSettings } from './types';

export const userSettings: Writable<UserSettings> = writable({
	width: 0,
	height: 0,
	bleed: 0,
	cropMarks: 0,
	repetitions: 1
});

export const userFiles: Writable<Array<UserFile>> = writable([]);

export const previewBlobUri = writable("");