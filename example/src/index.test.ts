import {_TEST_runIntegrationTest} from "../prisma/it-runner/runner";
import {PrismaClient} from ".prisma/client";

const prisma = new PrismaClient()

describe("test", () => {
  it("runner", _TEST_runIntegrationTest(prisma, {
    recordSet: {
      User: [
        { id: "1", name: "naruto", email: "naruto@example.com" }
      ]
    },
    method: async (prisma) => {
      await prisma.user.create({
        data: { id: "2", name: "sasuke", email: "sasuke@example.com" }
      })
      return prisma.user.findMany()
    },
    returns: [
      { id: "1", name: "naruto", email: "naruto@example.com" },
      { id: "2", name: "sasuke", email: "sasuke@example.com" }
    ],
    mutates: {
      User: [
        { id: "1", name: "naruto", email: "naruto@example.com" },
        { id: "2", name: "sasuke", email: "sasuke@example.com" }
      ]
    }
  }))
})
