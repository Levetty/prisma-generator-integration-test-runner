# prisma-generator-integration-test-runner

A Prisma generator for generating integration test runner.

## Motivation

When implementing integration tests using an actual database, several challenges arise:

- It is difficult to prepare seed records for testing, especially when foreign key constraints require the records to be inserted in a specific order.
- It is cumbersome to implement checks for the state of database records after executing the method under test.
- These implementations, along with verifying the values returned by the method under test and checking for errors, lead to redundant code that makes the tests less clear.

Therefore, this library provides a way to generate an integration test runner that addresses these challenges.

## Get started

### 1. Install the package

```shell
npm install -D prisma-generator-integration-test-runner
```

### 2. Add the generator to your Prisma schema

```prisma
generator integration-test-runner {
  provider = "prisma-generator-integration-test-runner"
}
```

### 3. Run the generator

```shell
npx prisma generate
```

When executed, by default, this creates an `it-runner` directory under the directory containing `schema.prisma`, and within this directory, the implementation of the test runner is generated.

## Usage

This library is intended to be used with [Jest](https://github.com/jestjs/jest).

Basic usage:

```ts
import { _TEST_runIntegrationTest } from "../prisma/it-runner/runner";
import { PrismaClient } from ".prisma/client";
import { addNinja } from "./ninja";

// IMPORTANT: Must be a connection to a test DB
const prisma = new PrismaClient();

describe("addNinja", () => {
  it(
    "should add sasuke and return naruto, sasuke",
    _TEST_ONLY_runIntegrationTest(prisma, {
      recordSet: {
        User: [{ id: "1", name: "naruto", email: "naruto@example.com" }],
      },
      method: async (prismaClient) => {
        return addNinja(prismaClient, "sasuke")
      },
      returns: [
        { id: "1", name: "naruto", email: "naruto@example.com" },
        { id: "2", name: "sasuke", email: "sasuke@example.com" },
      ],
      mutates: {
        User: [
          { id: "1", name: "naruto", email: "naruto@example.com" },
          { id: "2", name: "sasuke", email: "sasuke@example.com" },
        ],
      },
    }),
  );
});
```

### recordSet

```ts
recordSet: {
  User: [{id: "1", name: "naruto", email: "naruto@example.com"}]
}
```

The `recordSet` specifies the records to be inserted into the database before the test is run.  
For tables with foreign key constraints, the insertion order is automatically adjusted.  
(It is helpful to have a faker method prepared for generating record objects.)

### method

```ts
method: async (prismaClient) => {
  return addNinja(prismaClient, "sasuke")
}
```

The `method` parameter is used to pass the method under test. It is executed by passing `PrismaClient` as an argument, so please wrap the target method in an async function that takes `PrismaClient` as an argument. Of course, the method under test must also take `PrismaClient` or `TransactionClient` as an argument and use it to operate on the database.

### returns

```ts
returns: [
  { id: "1", name: "naruto", email: "naruto@example.com" },
  { id: "2", name: "sasuke", email: "sasuke@example.com" },
]
```

The `returns` parameter specifies the expected return value of the method under test. The runner verifies whether the value returned by the test subject matches the value specified here. However, currently, only objects can be specified in this field. If you want to validate values other than objects, please use `returnsAssert`.

### mutates

```ts
mutates: {
  User: [
    { id: "1", name: "naruto", email: "naruto@example.com" },
    { id: "2", name: "sasuke", email: "sasuke@example.com" },
  ]
}
```

The `mutates` parameter specifies the expected state of the database records after the execution of the method under test. After the method is executed, it verifies whether the records in the specified table match the state described here. If you want to sort the database records by a specific key for verification, please use the `mutatesSortKey` parameter.

#### `mutatesSortKey`

```ts
mutates: {
  Jutsu: [
    { name: "Izanagi", chakra: 300 },
    { name: "Chidori", chakra: 100 },
    { name: "Rasengan", chakra: 100 },
  ]
},
mutatesSortKeys: {
  Jutsu: ["chakra", "name"] // type safe!
}
```

When using the `mutatesSortKey`, you can sort the database records by any key and then compare and verify them against the content specified in `mutates`. Multiple keys can be specified, allowing for multi-key sorting. Additionally, the key specification is type safe.

## Credit

This implementation is based on the concept devised by @ryukez (Cloudbase, Inc).
