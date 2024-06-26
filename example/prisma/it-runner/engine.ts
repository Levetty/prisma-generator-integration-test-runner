// generated by prisma-generator-it-runner. Do not edit.
import {
  PrismaClient,
  Prisma,
  Link,
  User,
} from ".prisma/client";

export const modelNames = [
  "Link",
  "User",
];

export interface RecordSet {
  Link?: Link[];
  User?: User[];
}

export interface RecordSetAssertion {
  Link?: Partial<Link>[];
  User?: Partial<User>[];
}

export interface RecordSetAssertionSortKey {
  Link?: (keyof Link)[];
  User?: (keyof User)[];
}

export interface AutoIncrementReset {
  Link?: number;
  User?: number;
}

export async function applyRecordSet(
  db: PrismaClient,
  recordSet: RecordSet,
  autoIncrementReset: AutoIncrementReset,
) {
  await Promise.all([
    recordSet.Link ? db.$executeRawUnsafe(`DELETE FROM "Link";`) : Promise.resolve(),
    recordSet.User ? db.$executeRawUnsafe(`DELETE FROM "User";`) : Promise.resolve(),
  ]);
  
  await Promise.all([
    recordSet.Link ? db.link.createMany({ data: recordSet.Link ?? [] }) : Promise.resolve(),
    recordSet.User ? db.user.createMany({ data: recordSet.User ?? [] }) : Promise.resolve(),
  ]);
  
  const autoIncrementResetJobs: Promise<number>[] = [];
  if(autoIncrementReset.Link) autoIncrementResetJobs.push(db.$executeRawUnsafe(`SELECT SETVAL ('Link_id_seq', ${autoIncrementReset.Link}, false);`));
  if(autoIncrementReset.User) autoIncrementResetJobs.push(db.$executeRawUnsafe(`SELECT SETVAL ('User_id_seq', ${autoIncrementReset.User}, false);`));

  await Promise.all(autoIncrementResetJobs);
}

export async function importRecordSet(
  db: PrismaClient
): Promise<RecordSet> {
  const [
    Link,
    User,
  ] = await Promise.all([
    db.link.findMany(),
    db.user.findMany(),
  ]);

  return {
    Link,
    User,
  };
}

export async function assertRecordSet(
  db: PrismaClient,
  recordSet: RecordSetAssertion,
  assertFunc: <Model>(expected: Model[], actual: Model[], sortKeys?: (keyof Model)[]) => void,
  assertSortKey?: RecordSetAssertionSortKey,
) {
  // For each table, match records in order of their IDs.
  // If mutateSortKey is specified, use the results sorted by that key for matching.
  if (recordSet.Link) assertFunc(recordSet.Link, await db.link.findMany(), assertSortKey?.Link);
  if (recordSet.User) assertFunc(recordSet.User, await db.user.findMany(), assertSortKey?.User);
}

export interface Seeder {
  Link?: () => Link;
  User?: () => User;
}

// Fill missing records required for key constraints
export function autoComplete(recordSet: RecordSet, seeder: Seeder): RecordSet {
  // Apply auto complete for ignored tables only
  const original = Object.assign({}, recordSet);

  
  return recordSet;
}
