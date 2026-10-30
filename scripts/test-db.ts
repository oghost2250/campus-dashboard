import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.user.count()
  .then((c) => console.log("user count:", c))
  .catch((e) => console.error("error:", e))
  .finally(async () => prisma.$disconnect());
