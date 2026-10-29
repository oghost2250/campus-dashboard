/**
 * Bootstrap an admin (or approve an existing account):
 *
 *   npm run db:promote -- s-o.ali77@zewailcity.edu.eg
 *
 * Sets the account to ADMIN + ACTIVE and stamps `approvedAt`. Safe to run more
 * than once. Useful when you signed up before approvals were enabled, or when
 * you need a second admin.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error("Usage: npm run db:promote -- <email>");
    process.exit(1);
  }

  const user = await prisma.user
    .update({
      where: { email },
      data: { role: "ADMIN", status: "ACTIVE", approvedAt: new Date() },
      select: { id: true, email: true, name: true, role: true, status: true },
    })
    .catch((error: unknown) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2025"
      ) {
        console.error(`No account found for ${email}. Register first, then run this again.`);
        process.exit(1);
      }
      throw error;
    });

  console.log(`Promoted ${user.name ?? user.email} <${user.email}> to ${user.role}/${user.status}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
