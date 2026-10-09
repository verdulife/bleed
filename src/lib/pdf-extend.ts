import {
	type PDFPage,
	pushGraphicsState,
	popGraphicsState,
	moveTo,
	lineTo,
	closePath,
	clip,
	endPath
} from 'pdf-lib';
import type { PageBox } from '@/lib/page-boxes';

/**
 * Opens the artwork clip mask on `clipBox`.
 *
 * The box is a parameter, in the same style `setEmbed` already uses, so this module owns
 * only the geometry of the mask while the caller owns the policy: `none` clips the artwork
 * to the trim box so it cannot escape into the mark margin, and `mirror`/`natural` clip it
 * to the bleed box so the fill may reach the bleed line (`clipExtendsToBleed` in
 * `src/lib/bleed-mode.ts`). The box is in points, as read from the page.
 */
export function openCropMask(page: PDFPage, clipBox: PageBox) {
	page.pushOperators(
		pushGraphicsState(),
		moveTo(clipBox.x, clipBox.y),
		lineTo(clipBox.x + clipBox.width, clipBox.y),
		lineTo(clipBox.x + clipBox.width, clipBox.y + clipBox.height),
		lineTo(clipBox.x, clipBox.y + clipBox.height),
		closePath(),
		clip(),
		endPath()
	);
}

export function closeCropMask(page: PDFPage) {
	page.pushOperators(popGraphicsState());
}
