import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const email = "htdigital@gmail.com";
const prisma = new PrismaClient();

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("Admin bootstrap skipped outside Vercel production.");
    return;
  }

  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!password) {
    console.log("Admin bootstrap skipped: ADMIN_BOOTSTRAP_PASSWORD is not set.");
    return;
  }
  if (password.length < 12 || password.length > 128 || password.trim() !== password) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be 12-128 characters with no leading/trailing spaces.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin bootstrap skipped: account already exists.");
    return;
  }

  const role = await prisma.role.upsert({
    where: { key: "ADMIN" },
    update: {},
    create: {
      key: "ADMIN",
      name: "Administrator",
      description: "Full access to programs, people, staff, and records.",
    },
  });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name: "HT Digital Admin",
      passwordHash,
      roleId: role.id,
      active: true,
      isDemo: false,
    },
  });
  console.log("Production administrator account created.");
}

main()
  .catch((error) => {
    console.error("Admin bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
