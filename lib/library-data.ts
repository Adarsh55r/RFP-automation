import { prisma } from "@/lib/db";

export async function getLibraryItemsForUser(userId: string) {
  return prisma.libraryItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/** By Clerk ID, so a page can load the library alongside the user lookup instead of after it. */
export async function getLibraryItemsForClerkUser(clerkId: string) {
  return prisma.libraryItem.findMany({
    where: { user: { clerkId } },
    orderBy: { createdAt: "desc" },
  });
}
