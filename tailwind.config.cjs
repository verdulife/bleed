import { fontFamily } from 'tailwindcss/defaultTheme';
import tailwindScrollbar from 'tailwind-scrollbar';

/** @type {import('tailwindcss').Config}*/
const config = {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {
			fontFamily: {
				sans: ['InterVariable', fontFamily.sans]
			}
		}
	},

	plugins: [tailwindScrollbar]
};

module.exports = config;
