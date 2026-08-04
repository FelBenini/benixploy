import type { Session } from "$lib/server/domain/session";
import type { User } from "$lib/server/domain/user";

declare global {
  namespace App {
    interface Locals {
      session: Session | null;
      user: User | null;
      orgId: string | null;
    }
  }
}

export {};
