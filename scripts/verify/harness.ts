/**
 * Shared types and assertions for the zero-dependency verification harness.
 *
 * This project has no test framework on purpose (user decision, see
 * `odd/tasks/file-order-and-pdf-fixes.md`, "Resolved decisions" #4): the checks are
 * plain assertions in a committed script, run with `bun run verify`.
 */

export type VerifyCase = {
	/** Case name, printed verbatim in the PASS/FAIL line. */
	name: string;
	/** Throws when the case fails (every throw is reported as a FAIL). */
	run: () => Promise<void> | void;
};

/** A module entry point: returns the cases it contributes to the run. */
export type VerifyModule = () => VerifyCase[];

export function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

export function assertEqual<T>(actual: T, expected: T, message: string) {
	if (!Object.is(actual, expected)) {
		throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`);
	}
}

/** Shallow comparison for flat arrays (strings, numbers), compared by value. */
export function assertArrayEqual<T>(actual: T[], expected: T[], message: string) {
	if (actual.length !== expected.length) {
		throw new Error(
			`${message} (expected [${expected.join(', ')}], got [${actual.join(', ')}])`
		);
	}
	for (let index = 0; index < expected.length; index += 1) {
		if (!Object.is(actual[index], expected[index])) {
			throw new Error(
				`${message} (expected [${expected.join(', ')}], got [${actual.join(', ')}])`
			);
		}
	}
}

export function assertUnique(ids: number[], context: string) {
	const unique = new Set(ids);
	if (unique.size !== ids.length) {
		const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
		throw new Error(
			`${context}: ids must be unique, got [${ids.join(', ')}] (duplicates: ${[
				...new Set(duplicates)
			].join(', ')})`
		);
	}
}
