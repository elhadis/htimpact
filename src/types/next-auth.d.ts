import type { AppRole } from "@/lib/rbac";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      isDemo: boolean;
      active: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    isDemo: boolean;
    active: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    isDemo?: boolean;
    active?: boolean;
    refreshedAt?: number;
  }
}
