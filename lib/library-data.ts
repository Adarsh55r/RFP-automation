import { prisma } from "@/lib/db";

export async function getLibraryItemsForUser(userId: string) {
  return prisma.libraryItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}
