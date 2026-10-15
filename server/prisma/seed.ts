import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeding demo accounts is disabled in production.');
  }

  if (process.env.SEED_DEMO_USERS !== 'true') {
    console.log('Skipped demo user seeding. Set SEED_DEMO_USERS=true to enable it.');
    return;
  }

  const seedPassword = process.env.SEED_DEMO_PASSWORD;
  if (!seedPassword || seedPassword.length < 12) {
    throw new Error('SEED_DEMO_PASSWORD must be configured with at least 12 characters.');
  }

  const hashedPassword = await bcrypt.hash(seedPassword, 12);

  const accounts = [
    { email: 'admin@taskflow.vn', name: 'Quản Trị Viên Demo', role: Role.ADMIN },
    { email: 'manager@taskflow.vn', name: 'Quản Lý Demo', role: Role.MANAGER },
    { email: 'user@taskflow.vn', name: 'Nhân Viên Demo', role: Role.EMPLOYEE },
  ];

  const createdEmails: string[] = [];
  const existingEmails: string[] = [];

  for (const account of accounts) {
    const existingUser = await prisma.user.findUnique({
      where: { email: account.email },
      select: { id: true },
    });

    if (existingUser) {
      existingEmails.push(account.email);
      continue;
    }

    await prisma.user.create({
      data: {
        ...account,
        password: hashedPassword,
      },
    });
    createdEmails.push(account.email);
  }

  console.log(`Created demo accounts: ${createdEmails.join(', ') || 'none'}`);
  if (existingEmails.length > 0) {
    console.log(`Skipped existing accounts without changing them: ${existingEmails.join(', ')}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });