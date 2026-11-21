import { useEffect, useState } from "react";
import { loadAccess, type Access } from "@/lib/business/access.functions";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function useAccess() {
  const { user, isPending } = useCurrentUserState();
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    loadAccess()
      .then((row) => {
        if (live) setAccess(row);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : "Couldn’t load your plan.");
      });
    return () => {
      live = false;
    };
  }, [user?.id]);

  return { user, isPending, access, error, setAccess };
}
