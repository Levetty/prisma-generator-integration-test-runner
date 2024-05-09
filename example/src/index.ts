import type { PrismaClient, User } from ".prisma/client";

export const addNinja = async (
	prisma: PrismaClient,
	input: { id: string; name: string; email: string },
): Promise<User[]> => {
	await prisma.user.create({
		data: { id: input.id, name: input.name, email: input.email },
	});
	return prisma.user.findMany();
};
