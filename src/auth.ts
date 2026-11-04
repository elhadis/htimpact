import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { assertDemoAllowed } from "@/lib/demo";
import { isAppRole, type AppRole } from "@/lib/rbac";
import { loginSchema } from "@/lib/validators";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  pages: {},
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { role: true },
        });
        if (!user?.active || !isAppRole(user.role.key)) return null;
        if (!assertDemoAllowed(user.isDemo)) return null;
        const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordMatches) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.key,
          isDemo: user.isDemo,
          active: true,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const signedIn = user as {
          role?: AppRole;
          isDemo?: boolean;
          active?: boolean;
        };
        token.role = signedIn.role;
        token.isDemo = Boolean(signedIn.isDemo);
        token.active = signedIn.active !== false;
        token.refreshedAt = Date.now();
      }
      if (token.sub && Date.now() - Number(token.refreshedAt ?? 0) > 30_000) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: { role: true },
        });
        if (!dbUser?.active || !isAppRole(dbUser.role.key) || !assertDemoAllowed(dbUser.isDemo)) {
          token.active = false;
        } else {
          token.role = dbUser.role.key;
          token.isDemo = dbUser.isDemo;
          token.active = true;
          token.name = dbUser.name;
          token.email = dbUser.email;
        }
        token.refreshedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = isAppRole(String(token.role)) ? (token.role as AppRole) : "VIEWER";
      session.user.isDemo = Boolean(token.isDemo);
      session.user.active = token.active !== false;
      if (token.name) session.user.name = token.name;
      if (typeof token.email === "string") session.user.email = token.email;
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
