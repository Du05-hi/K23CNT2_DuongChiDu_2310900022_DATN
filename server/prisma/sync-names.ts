import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function syncNames() {
  try {
    console.log('[Sync] Bắt đầu rà soát và chuẩn hóa tên "Dương Chí Du" trong Cơ sở dữ liệu...');
    const users = await prisma.user.findMany();

    let updatedCount = 0;
    for (const user of users) {
      if (!user.name) continue;

      let newName = user.name;
      // Chuẩn hóa tất cả các biến thể gõ nhầm
      if (
        newName.includes('Dương Chí Dự') ||
        newName.includes('Dương Chí Dư') ||
        newName.includes('Chí Dự') ||
        newName.includes('Chí Dư')
      ) {
        newName = newName
          .replace(/Dương Chí Dự/g, 'Dương Chí Du')
          .replace(/Dương Chí Dư/g, 'Dương Chí Du')
          .replace(/Chí Dự/g, 'Chí Du')
          .replace(/Chí Dư/g, 'Chí Du');

        await prisma.user.update({
          where: { id: user.id },
          data: { name: newName },
        });

        console.log(`[Sync] Đã chuẩn hóa tên user (${user.email}): "${user.name}" -> "${newName}"`);
        updatedCount++;
      }
    }

    console.log(`[Sync] Hoàn tất rà soát chuẩn hóa tên. Tổng số bản ghi được cập nhật: ${updatedCount}`);
  } catch (err: any) {
    console.error('[Sync Error] Lỗi khi đồng bộ tên người dùng:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  syncNames();
}

