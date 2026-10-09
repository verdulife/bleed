/**
 * Verification runner for the zero-dependency harness (no test framework by project
 * decision). Run it from the repository root so Bun can resolve the `@/*` alias
 * declared by `tsconfig.json`:
 *
 *     bun run verify        (or: bun scripts/verify/index.ts)
 *
 * Each module in `modules` contributes its own cases; the runner prints one PASS/FAIL
 * line per case, a summary, and exits with code 1 when anything failed. Later work
 * units add their own module entry next to `getFileIdsCases`.
 */
import type { VerifyCase, VerifyModule } from './harness';
import { getFileIdsCases } from './file-ids';
import { getFileOrderCases } from './file-order';
import { getPdfBlankPageCases } from './pdf-blank-pages';
import { getPdfErrorCases } from './pdf-errors';
import { getPageBoxesCases } from './page-boxes';
import { getRenderInfoCases } from './render-info';
import { getBlankTemplateCases } from './blank-template';
import { getBleedModeCases } from './bleed-modes';
import { getBleedSizeCases } from './bleed-size';
import { getMinificationSafetyCases } from './minification-safety';

const modules: Array<{ label: string; load: VerifyModule }> = [
	{ label: 'file-ids', load: getFileIdsCases },
	{ label: 'file-order', load: getFileOrderCases },
	{ label: 'pdf-blank-pages', load: getPdfBlankPageCases },
	{ label: 'pdf-errors', load: getPdfErrorCases },
	{ label: 'page-boxes', load: getPageBoxesCases },
	{ label: 'render-info', load: getRenderInfoCases },
	{ label: 'blank-template', load: getBlankTemplateCases },
	{ label: 'bleed-modes', load: getBleedModeCases },
	{ label: 'bleed-size', load: getBleedSizeCases },
	{ label: 'minification-safety', load: getMinificationSafetyCases }
];

async function main() {
	let passed = 0;
	let failed = 0;

	for (const { label, load } of modules) {
		let cases: VerifyCase[];
		try {
			cases = load();
		} catch (error) {
			failed += 1;
			console.log(`FAIL  ${label}: could not load cases`);
			console.log(`        ${error instanceof Error ? error.message : String(error)}`);
			continue;
		}

		for (const testCase of cases) {
			try {
				await testCase.run();
				passed += 1;
				console.log(`PASS  ${testCase.name}`);
			} catch (error) {
				failed += 1;
				console.log(`FAIL  ${testCase.name}`);
				console.log(`        ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	const total = passed + failed;
	console.log('');
	console.log(`SUMMARY: ${passed}/${total} passed, ${failed} failed`);

	process.exit(failed > 0 ? 1 : 0);
}

await main();
