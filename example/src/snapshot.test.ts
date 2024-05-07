import { _TEST_ONLY_runIntegrationTest } from "../prisma/it-runner/runner";
import { PrismaClient } from ".prisma/client";
import { addNinja } from "./index";

const prisma = new PrismaClient();

describe("snapshot", () => {
	it(
		"runner",
		_TEST_ONLY_runIntegrationTest(prisma, {
			recordSet: {
				User: [{ id: "1", name: "naruto", email: "naruto@example.com" }],
			},
			method: async (prisma) =>
				addNinja(prisma, {
					id: "2",
					name: "sasuke",
					email: "sasuke@example.com",
				}),
			returns: [
				{ id: "1", name: "naruto", email: "naruto@example.com" },
				{ id: "2", name: "sasuke", email: "sasuke@example.com" },
			],
			snapshot: true,
		}),
	);
});
