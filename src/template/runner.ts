import {
	RecordSet,
	RecordSetAssertion,
	RecordSetAssertionSortKey,
	applyRecordSet,
	assertRecordSet,
	autoComplete,
} from "./engine";
import { PrismaClient } from ".prisma/client";

type RecursivePartial<K> = {
	[attr in keyof K]?: K[attr] extends object
		? RecursivePartial<K[attr]>
		: K[attr];
};

export interface TestCase<Return> {
	// State of DB records before test execution
	recordSet: RecordSet;

	// The method under test
	method: (db: PrismaClient) => Promise<Return>;

	// The expected return value or a function that takes the expected return value as an argument.
	returns?: RecursivePartial<Return>;

	// A function to execute on the method's return value before comparison with "returns".
	returnsPrehook?: (value: Return) => Promise<Return>;

	// snapshot test
	snapshot?: boolean;

	// Verify the "returns" result with assert. Can be used in conjunction with snapshots.
	returnsAssert?: (ret: Return) => Promise<void>;

	// The expected error
	throws?: jest.Constructable;

	// Additional assertion
	asserts?: (db: PrismaClient) => Promise<void>;

	// The expected state of records after executing the method under test.
	mutates?: RecordSetAssertion;

	// Specify this when you want to compare records in the database after sorting them by a specific key.
	// Keys are specified as an array, and if multiple keys are specified, comparison is done by sorting with compound keys in the specified order.
	mutatesSortKey?: RecordSetAssertionSortKey;
}

function assertRecords<Model>(
	expected: Model[],
	actual: Model[],
	sortKeys?: (keyof Model)[],
) {
	expect(actual.length).toEqual(expected.length);
	const a = sortKeys ? sortRecords(actual, sortKeys) : actual
	for (let i = 0; i < a.length; i++) {
		expect(a[i]).toMatchObject(expected[i] as any);
	}
}

// Sorts the object array passed in "records" in ascending order according to the keys provided.
// Keys are specified as an array, and if multiple elements are passed, sorting is done based on compound keys.
// If null, it will be placed last (similar to PostgreSQL's sorting behavior).
const sortRecords = <Model>(records: Model[], keys: (keyof Model)[]) => {
	const buildCompareFn = (keyIdx: number): ((a: any, b: any) => number) => {
		if (keys.length <= keyIdx) {
			return (_: any, __: any) => 0;
		}
		const key = keys[keyIdx];

		return (a: any, b: any) => {
			if (a[key] != null && b[key] != null) {
				if (a[key] > b[key]) {
					return 1;
				}
				if (a[key] < b[key]) {
					return -1;
				}
				return buildCompareFn(keyIdx + 1)(a, b);
			}
			if (a[key] != null) {
				return -1;
			}
			if (b[key] != null) {
				return 1;
			}
			return 0;
		};
	};

	return records.sort(buildCompareFn(0));
};

export function _TEST_ONLY_runIntegrationTest<Return>(
	db: PrismaClient,
	t: TestCase<Return> | (() => TestCase<Return>),
): jest.ProvidesCallback {
	return async function () {
		// To prevent execution in production environments
		if (process.env.NODE_ENV !== "test") {
			throw new Error(
				"integration test runner should only be used in NODE_ENV === test.",
			);
		}

		try {
			const tt = typeof t === "function" ? t() : t;

			const recordSet = autoComplete(tt.recordSet, {} /* WIP */);

			await applyRecordSet(db, recordSet, {});

			if (tt.throws) {
				await expect(tt.method(db)).rejects.toThrow(tt.throws);
				if (tt.asserts) {
					await tt.asserts(db);
				}
				if (tt.mutates) {
					await assertRecordSet(
						db,
						tt.mutates,
						assertRecords,
						tt.mutatesSortKey,
					);
				}
				return;
			}

			const ret = await tt
				.method(db)
				.then((value) =>
					tt.returnsPrehook ? tt.returnsPrehook(value) : value,
				);

			if (tt.returns !== undefined) {
				if (tt.returns === null) {
					expect(ret).toBeNull();
				} else {
					expect(ret).toMatchObject(tt.returns);
				}
			}
			if (tt.snapshot) expect(ret).toMatchSnapshot();
			if (tt.returnsAssert) await tt.returnsAssert(ret);
			if (tt.asserts) await tt.asserts(db);
			if (tt.mutates)
				await assertRecordSet(db, tt.mutates, assertRecords, tt.mutatesSortKey);
		} finally {
			await db.$disconnect();
		}
	};
}

export const __test_only__ = {
	sortRecords,
};
