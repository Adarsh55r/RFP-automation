"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { LibraryItemType } from "@/lib/generated/prisma";
import { resolvePlan } from "@/lib/plans";
import {
  isLibraryItemType,
  LIBRARY_ITEM_MAX_CHARS,
  LIBRARY_TOTAL_MAX_CHARS,
} from "@/lib/library";

export type LibraryItemPayload = {
  type: string;
  title: string;
  content: string;
};

async function requireLibraryUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false as const, error: "You must be signed in." };
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: { select: { tier: true, planVersion: true } } },
  });

  if (!user) {
    return {
      ok: false as const,
      error: "Complete onboarding before managing the library.",
    };
  }

  return { ok: true as const, user };
}

async function libraryRoom(userId: string, excludeId?: string) {
  const items = await prisma.libraryItem.findMany({
    where: { userId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { content: true, title: true },
  });
  const used = items.reduce((sum, item) => sum + item.content.length + item.title.length, 0);
  return LIBRARY_TOTAL_MAX_CHARS - used;
}

function tooBig(room: number) {
  return {
    ok: false as const,
    error: `Your library is full (${LIBRARY_TOTAL_MAX_CHARS.toLocaleString("en-US")} characters). Shorten or remove items you no longer use; only ${Math.max(room, 0).toLocaleString("en-US")} characters are left.`,
  };
}

function validatePayload(payload: LibraryItemPayload) {
  if (!isLibraryItemType(payload.type)) {
    return { ok: false as const, error: "Pick a valid content type." };
  }

  const title = payload.title.trim();
  const content = payload.content.trim();

  if (title.length < 2) {
    return { ok: false as const, error: "Enter a title (at least 2 characters)." };
  }

  if (content.length > LIBRARY_ITEM_MAX_CHARS) {
    return {
      ok: false as const,
      error: `Keep each item under ${LIBRARY_ITEM_MAX_CHARS.toLocaleString("en-US")} characters. Split long documents into separate case studies or answers.`,
    };
  }

  if (content.length < 10) {
    return {
      ok: false as const,
      error: "Add enough content for drafts to use (at least 10 characters).",
    };
  }

  return {
    ok: true as const,
    type: payload.type,
    title,
    content,
  };
}

export async function createLibraryItem(payload: LibraryItemPayload) {
  const authResult = await requireLibraryUser();
  if (!authResult.ok) {
    return authResult;
  }

  const validated = validatePayload(payload);
  if (!validated.ok) {
    return validated;
  }

  if (validated.type === LibraryItemType.company_profile) {
    const existing = await prisma.libraryItem.count({
      where: {
        userId: authResult.user.id,
        type: LibraryItemType.company_profile,
      },
    });

    if (existing > 0) {
      return {
        ok: false as const,
        error:
          "You already have a company profile. Edit the existing one instead of adding another.",
      };
    }
  }

  const maxItems = resolvePlan(authResult.user.subscription).libraryItems;
  if (maxItems !== null) {
    const count = await prisma.libraryItem.count({ where: { userId: authResult.user.id } });
    if (count >= maxItems) {
      return {
        ok: false as const,
        error: `Your plan's library holds up to ${maxItems} items. Combine or remove items you no longer use, or move to Pro for no item limit.`,
      };
    }
  }

  const room = await libraryRoom(authResult.user.id);
  if (validated.content.length + validated.title.length > room) {
    return tooBig(room);
  }

  const item = await prisma.libraryItem.create({
    data: {
      userId: authResult.user.id,
      type: validated.type,
      title: validated.title,
      content: validated.content,
    },
  });

  revalidatePath("/dashboard/library");

  return { ok: true as const, item };
}

export async function updateLibraryItem(
  id: string,
  payload: LibraryItemPayload,
) {
  const authResult = await requireLibraryUser();
  if (!authResult.ok) {
    return authResult;
  }

  const validated = validatePayload(payload);
  if (!validated.ok) {
    return validated;
  }

  const existing = await prisma.libraryItem.findFirst({
    where: { id, userId: authResult.user.id },
  });

  if (!existing) {
    return { ok: false as const, error: "Library item not found." };
  }

  if (
    validated.type === LibraryItemType.company_profile &&
    existing.type !== LibraryItemType.company_profile
  ) {
    const profileCount = await prisma.libraryItem.count({
      where: {
        userId: authResult.user.id,
        type: LibraryItemType.company_profile,
        NOT: { id },
      },
    });

    if (profileCount > 0) {
      return {
        ok: false as const,
        error:
          "You already have a company profile. Keep only one profile blurb.",
      };
    }
  }

  const room = await libraryRoom(authResult.user.id, id);
  if (validated.content.length + validated.title.length > room) {
    return tooBig(room);
  }

  const item = await prisma.libraryItem.update({
    where: { id },
    data: {
      type: validated.type,
      title: validated.title,
      content: validated.content,
    },
  });

  revalidatePath("/dashboard/library");

  return { ok: true as const, item };
}

export async function deleteLibraryItem(id: string) {
  const authResult = await requireLibraryUser();
  if (!authResult.ok) {
    return authResult;
  }

  const existing = await prisma.libraryItem.findFirst({
    where: { id, userId: authResult.user.id },
  });

  if (!existing) {
    return { ok: false as const, error: "Library item not found." };
  }

  await prisma.libraryItem.delete({ where: { id } });
  revalidatePath("/dashboard/library");

  return { ok: true as const };
}
