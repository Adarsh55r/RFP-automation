"use client";

import { useAuth } from "@clerk/nextjs";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Tags browser errors with the signed-in account id (never the email) so they can be traced to a customer. */
export function SentryUser() {
  const { userId } = useAuth();
  useEffect(() => {
    Sentry.setUser(userId ? { id: userId } : null);
  }, [userId]);
  return null;
}
