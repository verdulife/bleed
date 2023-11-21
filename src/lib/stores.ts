import { writable } from 'svelte/store';

export const userSettings = writable({
	width: 0,
	height: 0,
	bleed: 0,
	cutMarks: false,
	repetitions: 1
});

export const userFiles = writable([]);
