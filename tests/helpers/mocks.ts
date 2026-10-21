/** Shared state for module mocks declared with vi.mock in each test file. */
export const authState: { clerkId: string | null } = { clerkId: null };

export const storage = new Map<string, Buffer>();

export function signInAs(clerkId: string | null) {
  authState.clerkId = clerkId;
}
